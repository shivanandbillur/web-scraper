import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { LeadList, LeadItem, LogEntry } from "@/types/leads";

const STORAGE_KEY = "leadScraperLists";
const SETTINGS_KEY = "leadEngineSettings";

export type EngineSettings = {
  apiKey: string;
  searchEngine: "google" | "bing" | "duckduckgo";
  proxyEnabled: boolean;
  proxyUrl: string;
  maxRetries: number;
  delayBetweenRequests: number;
};

const defaultSettings: EngineSettings = {
  apiKey: "",
  searchEngine: "google",
  proxyEnabled: false,
  proxyUrl: "",
  maxRetries: 3,
  delayBetweenRequests: 1000,
};

export function useLeadEngine() {
  const [naturalQuery, setNaturalQuery] = useState("");
  const [numResults, setNumResults] = useState(10);
  const [enableDynamicExclusions, setEnableDynamicExclusions] = useState(true);
  const [manualExclusionsText, setManualExclusionsText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [settings, setSettings] = useState<EngineSettings>(defaultSettings);
  const [runStats, setRunStats] = useState({ rawLeadsFound: 0, currentQuery: 0, totalQueries: 0 });

  const abortControllerRef = useRef<AbortController | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedLists = JSON.parse(saved);
        setLists(parsedLists);
        if (parsedLists.length > 0) {
          setCurrentListId(parsedLists[0].id);
        }
      } catch { }
    }
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try { setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) }); } catch { }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    }
  }, [lists, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const activeList = lists.find((l) => l.id === currentListId);

  const addLog = useCallback((message: string, type?: LogEntry["type"]) => {
    setLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), message, type },
    ]);
  }, []);

  const simulateDemo = useCallback((listId: string) => {
    addLog("Backend not available. Running demo simulation...", "info");

    const demoLeads: LeadItem[] = [
      { url: "https://linkedin.com/in/rahul-sharma", data: [{ name: "Rahul Sharma", jobTitle: "BTL Marketing Manager", company: "Hindustan Unilever", location: "Mumbai, India", emails: ["rahul@example.com"], rawBio: "Experienced BTL marketing professional" }] },
      { url: "https://linkedin.com/in/priya-menon", data: [{ name: "Priya Menon", jobTitle: "Offline Marketing Head", company: "ITC Limited", location: "Bangalore, India", emails: [], rawBio: "Leading offline marketing campaigns" }] },
      { url: "https://linkedin.com/in/amit-patel", data: [{ name: "Amit Patel", jobTitle: "Experiential Marketing Director", company: "Godrej Consumer", location: "Delhi, India", emails: ["amit.p@example.com"], rawBio: "BTL & experiential marketing expert" }] },
      { url: "https://linkedin.com/in/sneha-reddy", data: [{ name: "Sneha Reddy", jobTitle: "Brand Activation Manager", company: "Marico", location: "Hyderabad, India", emails: [], rawBio: "Brand activation and trade marketing" }] },
      { url: "https://linkedin.com/in/vikram-singh", data: [{ name: "Vikram Singh", jobTitle: "Trade Marketing Manager", company: "Dabur India", location: "Noida, India", emails: ["vikram@example.com"], rawBio: "Trade marketing and distribution" }] },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i >= Math.min(demoLeads.length, numResults)) {
        clearInterval(interval);
        addLog(`Demo complete! Extracted ${Math.min(demoLeads.length, numResults)} leads.`, "success");
        setIsRunning(false);
        return;
      }

      addLog(`[${i + 1}/${Math.min(demoLeads.length, numResults)}] Extracting: ${demoLeads[i].data[0].name}`);
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId ? { ...l, leads: [...l.leads, demoLeads[i]] } : l
        )
      );
      i++;
    }, 800);
  }, [numResults, addLog]);

  const startScraping = useCallback(async () => {
    if (!naturalQuery.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsRunning(true);
    setRunStats({ rawLeadsFound: 0, currentQuery: 0, totalQueries: 0 });
    setLogs([{ time: new Date().toLocaleTimeString(), message: "Starting lead generation engine..." }]);

    const newListId = uuidv4();
    const newList: LeadList = {
      id: newListId,
      name: `${naturalQuery.substring(0, 30) || "Lead Search"} - ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      leads: [],
    };

    setLists((prev) => [newList, ...prev]);
    setCurrentListId(newListId);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: naturalQuery,
          numResults,
          enableDynamicExclusions,
          manualExclusions: manualExclusionsText.split('\n').map(s => s.trim()).filter(Boolean)
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "log") {
                  addLog(data.data);
                } else if (data.type === "error") {
                  addLog(`ERROR: ${data.data}`, "error");
                  setIsRunning(false);
                } else if (data.type === "item_extracted") {
                  setLists((prev) =>
                    prev.map((l) =>
                      l.id === newListId
                        ? { ...l, leads: [...l.leads, data.data as LeadItem] }
                        : l
                    )
                  );
                } else if (data.type === 'export_url') {
                  addLog(`Data pushed to Google Sheet!`, "success");
                } else if (data.type === "done") {
                  addLog("Job complete!", "success");
                  setIsRunning(false);
                } else if (data.type === "stats") {
                  setRunStats(data.data);
                }
              } catch { }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog("API Fetch aborted successfully.", "info");
      } else {
        addLog(`Connection Error: ${error.message}. Running demo...`, "error");
        simulateDemo(newListId);
      }
    }
  }, [naturalQuery, numResults, enableDynamicExclusions, manualExclusionsText, addLog, simulateDemo]);

  const stopScraping = useCallback(() => {
    setIsRunning(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    addLog("Execution stopped by user.", "info");
  }, [addLog]);

  const deleteList = useCallback((id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    if (currentListId === id) {
      setCurrentListId(null);
    }
  }, [currentListId]);

  const deleteLeads = useCallback((listId: string, leadUrls: string[]) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, leads: l.leads.filter((lead) => !leadUrls.includes(lead.url)) }
          : l
      )
    );
  }, []);

  const importLeads = useCallback((leads: LeadItem[], fileName: string) => {
    const newListId = uuidv4();
    const newList: LeadList = {
      id: newListId,
      name: `Import: ${fileName} - ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      leads,
    };
    setLists((prev) => [newList, ...prev]);
    setCurrentListId(newListId);
    addLog(`Imported ${leads.length} leads from ${fileName}`, "success");
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const clearAllData = useCallback(() => {
    setLists([]);
    setCurrentListId(null);
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
    addLog("All data cleared.", "info");
  }, [addLog]);

  return {
    naturalQuery, setNaturalQuery,
    numResults, setNumResults,
    enableDynamicExclusions, setEnableDynamicExclusions,
    manualExclusionsText, setManualExclusionsText,
    isRunning,
    runStats,
    logs,
    lists,
    currentListId, setCurrentListId,
    activeList,
    startScraping,
    stopScraping,
    deleteList,
    deleteLeads,
    importLeads,
    clearLogs,
    clearAllData,
    settings,
    setSettings,
  };
}
