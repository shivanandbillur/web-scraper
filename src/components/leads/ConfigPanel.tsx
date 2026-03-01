import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pencil, Database, FileSpreadsheet, Play, Square, History, Upload } from "lucide-react";
import QueryHistoryModal from "./QueryHistoryModal";
import * as XLSX from "xlsx";

type Props = {
  naturalQuery: string;
  setNaturalQuery: (v: string) => void;
  numResults: number;
  setNumResults: (v: number) => void;
  enableDynamicExclusions: boolean;
  setEnableDynamicExclusions: (v: boolean) => void;
  manualExclusionsText: string;
  setManualExclusionsText: (v: string) => void;
  spendLimit: number;
  setSpendLimit: (v: number) => void;
  currentSpend: number;
  allTimeCost: number;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
};

const ConfigPanel = ({
  naturalQuery, setNaturalQuery,
  numResults, setNumResults,
  enableDynamicExclusions, setEnableDynamicExclusions,
  manualExclusionsText, setManualExclusionsText,
  spendLimit, setSpendLimit,
  currentSpend,
  allTimeCost,
  isRunning, onStart, onStop,
}: Props) => {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/suggestions');
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.slice(0, 3));
        }
      } catch (err) { }
      setLoadingSuggestions(false);
    }
    fetchSuggestions();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        let fullText = "";
        workbook.SheetNames.forEach(sheetName => {
          const xlRowData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
          fullText += xlRowData.map(row => (row as any[]).join(" ")).join("\n") + "\n";
        });

        const matches = fullText.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com(?:\/in\/|\s*›\s*in\s*›\s*)([^\s\/"?',|]+)/gi);
        if (matches) {
          const handles = matches.map(m => {
            const parts = m.split(/in[\/›\s]+/);
            return parts.length > 1 ? `https://linkedin.com/in/${parts.pop()?.trim()}` : '';
          }).filter(Boolean);

          if (handles.length > 0) {
            const unique = Array.from(new Set(handles));
            setManualExclusionsText(manualExclusionsText + (manualExclusionsText ? '\n' : '') + unique.join('\n'));
            alert(`Extracted ${unique.length} valid LinkedIn profiles from the file.`);
          } else {
            alert("No valid LinkedIn profile URLs found in the file.");
          }
        } else {
          alert("No valid LinkedIn profile URLs found in the file.");
        }
      } catch (err) {
        console.error("Error parsing file", err);
        alert("Failed to parse the file.");
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 flex flex-col gap-5"
      >
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="p-2 border border-border bg-muted">
            <Pencil className="w-4 h-4 text-foreground" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Configuration</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 block">
              Target Prompt
            </label>
            <textarea
              value={naturalQuery}
              onChange={(e) => setNaturalQuery(e.target.value)}
              placeholder="e.g. Find me BTL managers or offline marketing managers in India..."
              className="input-field w-full px-4 py-3 h-28 resize-none text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {loadingSuggestions ? (
                <span className="text-[10px] text-muted-foreground animate-pulse">Generative AI is tailoring suggestions based on your history...</span>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNaturalQuery(suggestion)}
                    className="text-[10px] bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-1 rounded truncate max-w-full text-left transition-colors cursor-pointer border border-border"
                    title={suggestion}
                  >
                    💡 {suggestion}
                  </button>
                ))
              ) : null}
            </div>
          </div>

          {/* ── Primary action — right under the prompt ── */}
          <button
            onClick={isRunning ? onStop : onStart}
            className={`w-full flex items-center justify-center gap-3 py-4 text-sm transition-all duration-300 ${isRunning ? 'btn-danger-glow' : 'btn-primary-glow'}`}
          >
            {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isRunning ? "STOP" : "GENERATE LEADS"}
          </button>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 block">
                Leads Goal
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={numResults}
                onChange={(e) => setNumResults(Number(e.target.value))}
                className="input-field w-full px-4 py-3 font-semibold"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-widest mb-2 flex justify-between items-center">
                <span>Spend Limit ($)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 items-center justify-center top-3 font-semibold text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={spendLimit}
                  onChange={(e) => setSpendLimit(Number(e.target.value))}
                  className="input-field w-full pl-7 pr-4 py-3 font-semibold"
                />
              </div>
              {/* Cost breakdown — always visible, not just while running */}
              <div className="mt-2 flex flex-col gap-1 bg-muted/40 border border-border rounded p-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">This Run</span>
                  <span className={`text-[11px] font-bold tabular-nums ${currentSpend >= spendLimit * 0.9 ? 'text-red-500' : 'text-emerald-500'
                    } ${isRunning ? 'animate-pulse' : ''}`}>
                    ${currentSpend.toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-border/50 pt-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">All-Time Total</span>
                  <span className="text-[11px] font-bold tabular-nums text-amber-500">
                    ${allTimeCost.toFixed(5)}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                  ⚠️ OpenAI dashboard shows cumulative cost across ALL runs. &quot;This Run&quot; resets each search.
                </p>
              </div>
            </div>
          </div>

          {/* ── Compact cost bar ── */}
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 border border-border/50 rounded text-[10px]">
            <span className="text-muted-foreground">Run</span>
            <span className={`font-bold tabular-nums ${currentSpend >= spendLimit * 0.9 ? 'text-red-500' : 'text-emerald-500'} ${isRunning ? 'animate-pulse' : ''}`}>${currentSpend.toFixed(5)}</span>
            <span className="text-border/60 mx-0.5">|</span>
            <span className="text-muted-foreground">All-time</span>
            <span className="font-bold tabular-nums text-amber-500">${allTimeCost.toFixed(5)}</span>
            <span className="ml-auto text-muted-foreground/50 cursor-help" title="OpenAI dashboard = all runs combined. 'Run' resets each search.">ⓘ</span>
          </div>

          <div className="flex flex-col gap-3 bg-muted/30 p-3 border border-border">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">Native Exclusions Active</span>
                <span className="text-[10px] text-muted-foreground">Always blocking old queries, database duplicates & leadsc - sheet1 (1).csv</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={enableDynamicExclusions}
                onChange={e => setEnableDynamicExclusions(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
                id="dynamic-exclusions"
              />
              <div className="flex flex-col">
                <label htmlFor="dynamic-exclusions" className="text-xs font-semibold cursor-pointer">Semantic & Anti-Persona Filter Generator</label>
                <p className="text-[10px] text-muted-foreground">AI explicitly negates irrelevant roles and reads bios to block those outside ICP target.</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block">
                Manual Exclusions (URLs)
              </label>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest border border-border px-2 py-1 rounded bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 transition-colors">
                <Upload className="w-3 h-3" /> Upload CSV/XLSX
                <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <textarea
              value={manualExclusionsText}
              onChange={e => setManualExclusionsText(e.target.value)}
              placeholder="Paste LinkedIn URLs to exclude (one per line)..."
              className="input-field w-full px-4 py-3 h-20 resize-none text-xs"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3 p-3 border border-border bg-muted/50">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Knowledge Base</p>
                  <p className="text-[10px] text-muted-foreground">Duplicates blocked natively</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition-all"
              >
                <History className="w-3 h-3" /> Queries
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 border border-border bg-muted/50">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Auto-Sync</p>
                <p className="text-[10px] text-muted-foreground">XLSX export on demand</p>
              </div>
            </div>
          </div>
        </div>

      </motion.div>
      <QueryHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
    </>
  );
};

export default ConfigPanel;
