"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Search, Terminal, Database, Pencil,
  Play, Square, ChevronRight, Globe, Layers, Download,
  Settings, UploadCloud, FileSpreadsheet, Trash2, History,
  CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

type LeadItem = {
  url: string;
  data: any[];
};

type LeadList = {
  id: string;
  name: string;
  date: string;
  leads: LeadItem[];
};

export default function Home() {
  // Search Form State
  const [naturalQuery, setNaturalQuery] = useState("");
  const [numResults, setNumResults] = useState(10);

  // App State
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ time: string, message: string, type?: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // History / Lists State
  const [lists, setLists] = useState<LeadList[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('leadScraperLists');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLists(parsed);
        // Do not automatically select the old list to prevent showing old records immediately
      } catch (e) { }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('leadScraperLists', JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getActiveList = () => lists.find(l => l.id === currentListId);

  const startScraping = async () => {
    setIsRunning(true);
    setLogs([{ time: new Date().toLocaleTimeString(), message: "Starting algorithmic web automation sequence..." }]);

    // Create a new list for this run
    const newListId = uuidv4();
    const newList: LeadList = {
      id: newListId,
      name: `${naturalQuery.substring(0, 20) || 'Lead Search'} - ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      leads: []
    };

    setLists(prev => [newList, ...prev]);
    setCurrentListId(newListId);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: naturalQuery,
          numResults,
        }),
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
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'log') {
                  setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message: data.data }]);
                } else if (data.type === 'error') {
                  setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message: `ERROR: ${data.data}`, type: 'error' }]);
                  setIsRunning(false);
                } else if (data.type === 'item_extracted') {
                  // Update the specific list
                  setLists((prev) => prev.map(l => l.id === newListId ? { ...l, leads: [...l.leads, data.data] } : l));
                } else if (data.type === 'export_url') {
                  // if backend exported to google sheet
                  setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message: `Data pushed to Google Sheet!`, type: 'success' }]);
                } else if (data.type === 'done') {
                  setIsRunning(false);
                }
              } catch (e) {
                // partial chunks error
              }
            }
          }
        }
      }
    } catch (error: any) {
      setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message: `Fetch Error: ${error.message}`, type: 'error' }]);
      setIsRunning(false);
    }
  };

  const deleteList = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLists(prev => prev.filter(l => l.id !== id));
    if (currentListId === id) setCurrentListId(lists[0]?.id || null);
  };

  const exportToExcel = () => {
    const list = getActiveList();
    if (!list || list.leads.length === 0) return;

    // Flatten data for tabular format
    const flattened = list.leads.map(lead => {
      const data = lead.data[0] || {};
      return {
        "LinkedIn URL": lead.url,
        "Name": data.name || "Unknown",
        "Job Title": data.jobTitle || "Unknown",
        "Company": data.company || "Unknown",
        "Location": data.location || "Unknown",
        "Emails": data.emails ? data.emails.join(", ") : "",
        "Bio": data.rawBio || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(flattened);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    XLSX.writeFile(workbook, `${list.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
  };

  const activeList = getActiveList();

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1700px] mx-auto text-slate-200">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700/50 pb-6 pt-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Globe className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Offline Marketing Lead Engine
            </h1>
            <p className="text-slate-400 text-sm mt-1">Algorithmic X-Ray Search & Data Extractor</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[700px]">

        {/* Left Column: Configuration */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 custom-scrollbar">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-2xl flex flex-col gap-5 border-t border-t-blue-500/20 shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <Pencil className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Target ICP Configuration</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 block">Natural Language Prompt</label>
                <textarea
                  value={naturalQuery}
                  onChange={(e) => setNaturalQuery(e.target.value)}
                  placeholder="e.g. Find me btl managers or offline marketing managers..."
                  className="input-field w-full px-4 py-3 rounded-xl h-24 resize-none"
                />
              </div>

              <div className="pt-3">
                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 block">Leads Goal</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={numResults}
                  onChange={(e) => setNumResults(Number(e.target.value))}
                  className="input-field w-full px-4 py-3 rounded-xl text-white font-semibold"
                />
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <Database className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs font-semibold text-purple-300">SQLite Knowledge Base Active</p>
                    <p className="text-[10px] text-purple-400/70">Duplicate queries & profiles are automatically blocked.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Auto-CSV Sync Active</p>
                    <p className="text-[10px] text-emerald-400/70">Syncing with leadsc - sheet1 (1).csv</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={isRunning ? () => setIsRunning(false) : startScraping}
              disabled={isRunning && false}
              className={`mt-4 w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg ${isRunning
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/25'
                }`}
            >
              {isRunning ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              {isRunning ? "Stop Execution" : "Generate Leads"}
            </button>
          </motion.div>

          {/* History Lists */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 glass-panel p-6 rounded-2xl flex flex-col gap-4 border-t border-t-amber-500/20 shadow-xl min-h-[250px]"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <History className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Execution History</h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {lists.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-4">No previous lists. Run a task to create one.</p>
              ) : (
                lists.map(list => (
                  <div
                    key={list.id}
                    onClick={() => setCurrentListId(list.id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${currentListId === list.id ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'}`}
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-semibold truncate text-slate-200">{list.name}</span>
                      <span className="text-[10px] text-slate-400">{new Date(list.date).toLocaleString()} • {list.leads.length} leads</span>
                    </div>
                    <button onClick={(e) => deleteList(list.id, e)} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Middle Column: Server Logs */}
        <div className="lg:col-span-3 h-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-2xl p-5 flex flex-col gap-4 border-t border-t-purple-500/20 shadow-xl h-full"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Server Terminal</h2>
              </div>
              {isRunning && (
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs bg-[#080b12]/80 p-3 rounded-xl border border-slate-800 shadow-inner custom-scrollbar">
              <AnimatePresence>
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic mt-2 text-center text-xs">Waiting for events...</p>
                ) : (
                  logs.map((log, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2 pb-1.5 border-b border-slate-800/50 last:border-0"
                    >
                      <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                      <span className={log.type === 'error' ? 'text-rose-400' :
                        log.message.includes('Extracting') || log.message.includes('Page') ? 'text-blue-300' :
                          log.message.includes('Success') ? 'text-emerald-400' : 'text-slate-400'}>
                        {log.message}
                      </span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </div>
          </motion.div>
        </div>

        {/* Right Column: Data Output Table */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-5 glass-panel rounded-2xl p-0 flex flex-col overflow-hidden border-t border-t-emerald-500/20 shadow-xl"
        >
          {/* Table Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2 className="text-md font-semibold text-white">
                {activeList ? activeList.name : "Structured List Table"}
              </h2>
              {activeList && (
                <span className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded-full text-xs font-bold ml-1">
                  {activeList.leads.length} found
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                disabled={!activeList || activeList.leads.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export XLSX
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar">
            {!activeList || activeList.leads.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
                <Database className="w-12 h-12 mb-4 opacity-50" />
                <p>No leads extracted in this list yet.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="text-xs text-slate-500 uppercase bg-slate-800/80 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status / URL</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Title & Company</th>
                    <th className="px-4 py-3 font-medium">Emails</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.leads.map((lead, idx) => {
                    const d = lead.data[0] || {};
                    // Clean up linkedin URL
                    const cleanUrl = lead.url.split('?')[0];

                    return (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 max-w-[140px]">
                          <a href={lead.url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs truncate block hover:underline" title={lead.url}>
                            {cleanUrl.replace('https://in.linkedin.com/in/', '').replace('https://www.linkedin.com/in/', '')}
                          </a>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Scraped
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">
                          {d.name || "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-300 font-medium line-clamp-1" title={d.jobTitle}>{d.jobTitle || "Unknown"}</div>
                          <div className="text-xs text-slate-500 mt-0.5 object-cover">{d.company || d.location}</div>
                        </td>
                        <td className="px-4 py-3">
                          {d.emails && d.emails.length > 0 ? (
                            <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">
                              {d.emails[0]}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

      </div>
    </main>
  );
}
