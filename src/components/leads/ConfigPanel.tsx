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
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
};

const ConfigPanel = ({
  naturalQuery, setNaturalQuery,
  numResults, setNumResults,
  enableDynamicExclusions, setEnableDynamicExclusions,
  manualExclusionsText, setManualExclusionsText,
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
            setManualExclusionsText((prev: string) => prev + (prev ? '\n' : '') + unique.join('\n'));
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

          <div className="flex items-center gap-3 bg-muted/30 p-3 border border-border">
            <input
              type="checkbox"
              checked={enableDynamicExclusions}
              onChange={e => setEnableDynamicExclusions(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
              id="dynamic-exclusions"
            />
            <div className="flex flex-col">
              <label htmlFor="dynamic-exclusions" className="text-xs font-semibold cursor-pointer">AI Dynamic Exclusions</label>
              <p className="text-[10px] text-muted-foreground">Auto-infer and exclude anti-persona leads</p>
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

        <button
          onClick={isRunning ? onStop : onStart}
          className={`mt-2 w-full flex items-center justify-center gap-3 py-4 text-sm transition-all duration-300 ${isRunning ? 'btn-danger-glow' : 'btn-primary-glow'
            }`}
        >
          {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isRunning ? "STOP" : "GENERATE LEADS"}
        </button>
      </motion.div>
      <QueryHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
    </>
  );
};

export default ConfigPanel;
