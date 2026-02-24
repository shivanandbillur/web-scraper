import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, X, Globe, Shield, Clock, RotateCcw } from "lucide-react";
import type { EngineSettings } from "@/hooks/useLeadEngine";

type Props = {
  settings: EngineSettings;
  setSettings: (s: EngineSettings) => void;
  onClearLogs: () => void;
  onClearAllData: () => void;
};

const SettingsPanel = ({ settings, setSettings, onClearLogs, onClearAllData }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const update = (partial: Partial<EngineSettings>) => {
    setSettings({ ...settings, ...partial });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 border border-border bg-muted hover:bg-accent px-3 py-2 text-xs font-bold text-foreground transition-all uppercase tracking-wider"
      >
        <Settings className="w-4 h-4" /> Settings
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-border bg-muted">
                    <Settings className="w-4 h-4 text-foreground" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Settings</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                {/* API Key */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="w-3.5 h-3.5" />
                    <label className="text-[10px] uppercase font-bold tracking-widest">API Key</label>
                  </div>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => update({ apiKey: e.target.value })}
                    placeholder="Enter your API key..."
                    className="input-field w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Search Engine */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="w-3.5 h-3.5" />
                    <label className="text-[10px] uppercase font-bold tracking-widest">Search Engine</label>
                  </div>
                  <div className="flex gap-2">
                    {(["google", "bing", "duckduckgo"] as const).map((engine) => (
                      <button
                        key={engine}
                        onClick={() => update({ searchEngine: engine })}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider border transition-all ${
                          settings.searchEngine === engine
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                        }`}
                      >
                        {engine}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Proxy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="w-3.5 h-3.5" />
                      <label className="text-[10px] uppercase font-bold tracking-widest">Proxy</label>
                    </div>
                    <button
                      onClick={() => update({ proxyEnabled: !settings.proxyEnabled })}
                      className={`w-10 h-5 border transition-all relative ${
                        settings.proxyEnabled ? "bg-foreground border-foreground" : "bg-muted border-border"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 absolute top-0.5 transition-all ${
                          settings.proxyEnabled ? "right-1 bg-background" : "left-1 bg-muted-foreground"
                        }`}
                      />
                    </button>
                  </div>
                  {settings.proxyEnabled && (
                    <input
                      type="text"
                      value={settings.proxyUrl}
                      onChange={(e) => update({ proxyUrl: e.target.value })}
                      placeholder="http://proxy:port"
                      className="input-field w-full px-3 py-2 text-sm"
                    />
                  )}
                </div>

                {/* Max Retries */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <label className="text-[10px] uppercase font-bold tracking-widest">Max Retries</label>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settings.maxRetries}
                    onChange={(e) => update({ maxRetries: Number(e.target.value) })}
                    className="input-field w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Delay */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <label className="text-[10px] uppercase font-bold tracking-widest">Delay Between Requests (ms)</label>
                  </div>
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={settings.delayBetweenRequests}
                    onChange={(e) => update({ delayBetweenRequests: Number(e.target.value) })}
                    className="input-field w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Danger Zone */}
                <div className="pt-4 border-t border-border space-y-3">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Danger Zone</p>
                  <button
                    onClick={onClearLogs}
                    className="w-full py-2 text-xs font-bold uppercase tracking-wider border border-border bg-muted hover:bg-accent text-foreground transition-all"
                  >
                    Clear Terminal Logs
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("This will delete all lead lists and history. Are you sure?")) {
                        onClearAllData();
                        setIsOpen(false);
                      }
                    }}
                    className="w-full py-2 text-xs font-bold uppercase tracking-wider btn-danger-glow"
                  >
                    Clear All Data
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default SettingsPanel;
