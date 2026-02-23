"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Search, Terminal, Database,
  Play, Square, ChevronRight, Globe, Layers, Download
} from "lucide-react";

export default function Home() {
  const [searchEngine, setSearchEngine] = useState("google");
  const [searchQuery, setSearchQuery] = useState('BTL marketing manager "india"');
  const [numResults, setNumResults] = useState(5);

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{ time: string, message: string }[]>([]);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom of logs
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startScraping = async () => {
    if (!searchQuery) {
      alert("Please provide a search query.");
      return;
    }

    setIsRunning(true);
    setLogs([{ time: new Date().toLocaleTimeString(), message: "Starting algorithmic web automation sequence..." }]);
    setExtractedData([]);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQuery, searchEngine, numResults }),
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
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: data.data }]);
                } else if (data.type === 'error') {
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: `ERROR: ${data.data}` }]);
                  setIsRunning(false);
                } else if (data.type === 'item_extracted') {
                  setExtractedData(prev => [...prev, data.data]);
                } else if (data.type === 'done') {
                  setIsRunning(false);
                }
              } catch (e) {
                console.error("Error parsing stream chunk", e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: `Fetch Error: ${error.message}` }]);
      setIsRunning(false);
    }
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'scraped_leads.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1600px] mx-auto text-slate-200">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700/50 pb-6 pt-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Globe className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              LinkedIn Profile AI Scraper
            </h1>
            <p className="text-slate-400 text-sm mt-1">Algorithmic X-Ray Search for automated lead generation</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 h-full min-h-[600px]">

        {/* Left Column: Configuration & Chat */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-2xl flex flex-col gap-5 border-t border-t-blue-500/20 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Target ICP Criteria</h2>
            </div>

            <textarea
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. BTL marketing manager OR senior OR head offline marketing company india"
              className="input-field w-full h-40 p-4 rounded-xl text-md resize-none leading-relaxed transition-colors shadow-inner"
            ></textarea>

            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Search Engine</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={searchEngine}
                    onChange={(e) => setSearchEngine(e.target.value)}
                    className="input-field w-full appearance-none pl-10 pr-4 py-3 rounded-xl cursor-pointer"
                  >
                    <option value="google">Standard Web Search</option>
                    <option value="bing">Alternative Search Engine</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-32">
                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Target Pages</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numResults}
                  onChange={(e) => setNumResults(Number(e.target.value))}
                  className="input-field w-full px-4 py-3 rounded-xl text-center"
                />
              </div>
            </div>

            <button
              onClick={isRunning ? () => setIsRunning(false) : startScraping}
              disabled={isRunning && false}
              className={`mt-2 w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg ${isRunning
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/25'
                }`}
            >
              {isRunning ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              {isRunning ? "Stop Automation" : "Start Scraping Sequence"}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 glass-panel rounded-2xl p-6 flex flex-col gap-4 border-t border-t-purple-500/20 shadow-xl overflow-hidden h-full max-h-[500px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Execution Logs</h2>
              </div>
              {isRunning && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full animate-pulse border border-emerald-400/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  RUNNING
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-sm bg-[#080b12]/80 p-4 rounded-xl border border-slate-800 shadow-inner">
              <AnimatePresence>
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic mt-2 text-center">Standing by for execution...</p>
                ) : (
                  logs.map((log, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-4 pb-1 border-b border-slate-800/50 last:border-0 text-slate-300"
                    >
                      <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                      <span className={log.message.includes('ERROR') ? 'text-rose-400' :
                        log.message.includes('Extracting') ? 'text-blue-300' :
                          log.message.includes('Success') ? 'text-emerald-400' : ''}>
                        <ChevronRight className="inline w-3 h-3 mr-1 text-slate-600" />
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

        {/* Right Column: Data Output */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col gap-6 border-t border-t-emerald-500/20 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">Extracted Leads Data</h2>
              <span className="bg-slate-800 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold ml-2">
                {extractedData.length} entries
              </span>
            </div>
            {extractedData.length > 0 && (
              <button
                onClick={exportToJson}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-lg text-sm transition-colors"
                title="Download JSON"
              >
                <Download className="w-4 h-4" /> Export Data
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-[#080b12]/60 rounded-xl border border-slate-800/50 p-4 shadow-inner">
            {extractedData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <Layers className="w-16 h-16 mb-4 stroke-[1.5]" />
                <p>Scraped data will appear here.</p>
                <p className="text-sm mt-2 max-w-sm text-center">The system converts HTML parsed by Playwright Chromium into local JSON properties using regex & parsing algorithms perfectly without limits or external keys.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {extractedData.map((item, idx) => (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    key={idx}
                    className="bg-slate-800/80 border border-slate-700/60 p-5 rounded-xl flex flex-col gap-3 shadow-lg hover:border-emerald-500/30 transition-colors"
                  >
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline font-mono truncate max-w-full block mb-2 opacity-80">
                      {item.url}
                    </a>

                    {Array.isArray(item.data) ? (
                      item.data.map((d: any, index: number) => (
                        <div key={index} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          {Object.entries(d).map(([key, val]) => {
                            if (!val || (Array.isArray(val) && val.length === 0)) return null;
                            const isArray = Array.isArray(val);
                            return (
                              <div key={key} className="mb-2 last:mb-0 text-sm">
                                <span className="font-semibold text-slate-400 text-xs uppercase tracking-wider block mb-0.5">{key}</span>
                                <span className="text-slate-100">
                                  {isArray ? (val as any[]).join(', ') : String(val)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    ) : (
                      <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </main>
  );
}
