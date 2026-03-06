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
  const [spendLimit, setSpendLimit] = useState<number>(0.5); // Default $0.50 per session limit
  const [currentSpend, setCurrentSpend] = useState<number>(0);
  const [allTimeCost, setAllTimeCost] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [settings, setSettings] = useState<EngineSettings>(defaultSettings);
  const [runStats, setRunStats] = useState({ rawLeadsFound: 0, rejected: 0, kept: 0 });

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
      { url: "https://linkedin.com/in/demo-user-1", data: [{ name: "Alex Chen", jobTitle: "Software Engineer", company: "Tech Corp", location: "San Francisco, USA", emails: ["alex@example.com"], rawBio: "Experienced full-stack developer" }] },
      { url: "https://linkedin.com/in/demo-user-2", data: [{ name: "Sarah Jenkins", jobTitle: "Marketing Director", company: "Growth Co", location: "London, UK", emails: [], rawBio: "Leading global marketing campaigns" }] },
      { url: "https://linkedin.com/in/demo-user-3", data: [{ name: "Maria Garcia", jobTitle: "Product Manager", company: "Innovate Inc", location: "Madrid, Spain", emails: ["maria.g@example.com"], rawBio: "Building products that users love" }] },
      { url: "https://linkedin.com/in/demo-user-4", data: [{ name: "David Kim", jobTitle: "Sales Executive", company: "Cloud Solutions", location: "New York, USA", emails: [], rawBio: "Enterprise software sales" }] },
      { url: "https://linkedin.com/in/demo-user-5", data: [{ name: "Priya Patel", jobTitle: "Data Scientist", company: "AI Research Lab", location: "Bangalore, India", emails: ["priya@example.com"], rawBio: "Machine learning and predictive modeling" }] },
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
    setCurrentSpend(0);
    setRunStats({ rawLeadsFound: 0, rejected: 0, kept: 0 });
    setLogs([{ time: new Date().toLocaleTimeString(), message: "Starting lead generation engine..." }]);

    const newListId = uuidv4();
    const newList: LeadList = {
      id: newListId,
      name: `${naturalQuery.substring(0, 30) || "Lead Search"} - ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      leads: [],
      prompt: naturalQuery,
      targetCount: numResults,
      costSpent: 0,
      scanned: 0,
      rejected: 0,
      status: 'running',
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
          spendLimit,
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
                  setLists((prev) => prev.map((l) =>
                    l.id === newListId ? { ...l, status: 'done' } : l
                  ));
                } else if (data.type === "stats") {
                  const s = data.data;
                  setRunStats({
                    rawLeadsFound: s.rawLeadsFound ?? 0,
                    rejected: s.rejected ?? 0,
                    kept: s.kept ?? 0,
                  });
                  // Persist live stats to the list
                  setLists((prev) => prev.map((l) =>
                    l.id === newListId
                      ? { ...l, scanned: s.rawLeadsFound ?? 0, rejected: s.rejected ?? 0 }
                      : l
                  ));
                } else if (data.type === "cost_update") {
                  setCurrentSpend(data.data.totalCost);
                  if (data.data.allTimeCost !== undefined) {
                    setAllTimeCost(data.data.allTimeCost);
                  }
                  // Persist cost live to the list
                  setLists((prev) => prev.map((l) =>
                    l.id === newListId
                      ? { ...l, costSpent: data.data.totalCost, allTimeCostAtEnd: data.data.allTimeCost }
                      : l
                  ));
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
  }, [naturalQuery, numResults, enableDynamicExclusions, manualExclusionsText, spendLimit, addLog, simulateDemo]);

  const stopScraping = useCallback(() => {
    setIsRunning(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    addLog("Execution stopped by user.", "info");
    // Mark current list as stopped
    setLists((prev) => prev.map((l) =>
      l.status === 'running' ? { ...l, status: 'stopped' } : l
    ));
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
    spendLimit, setSpendLimit,
    currentSpend, setCurrentSpend,
    allTimeCost,
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
