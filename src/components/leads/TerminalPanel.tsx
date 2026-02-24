import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "lucide-react";
import type { LogEntry } from "@/types/leads";

type Props = {
  logs: LogEntry[];
  isRunning: boolean;
  extractedCount?: number;
  targetCount?: number;
};

const TerminalPanel = ({ logs, isRunning, extractedCount, targetCount }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (log: LogEntry) => {
    if (log.type === 'error') return 'text-muted-foreground';
    if (log.type === 'success') return 'text-foreground';
    if (log.message.includes('Extracting') || log.message.includes('Page') || log.message.includes('Query'))
      return 'text-foreground/80';
    if (log.message.includes('complete') || log.message.includes('Success'))
      return 'text-foreground';
    return 'text-muted-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-panel p-5 flex flex-col gap-4 h-full"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 border border-border bg-muted">
            <Terminal className="w-4 h-4 text-foreground" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Terminal</h2>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2">
            {targetCount !== undefined && extractedCount !== undefined && (
              <span className="text-[10px] text-foreground/80 font-medium tracking-wide">
                (Goal: {extractedCount}/{targetCount})
              </span>
            )}
            <div className="w-2 h-2 bg-foreground animate-pulse" />
            <span className="text-[10px] text-foreground font-medium uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="overflow-y-auto font-mono text-xs terminal-bg p-3 custom-scrollbar h-[350px] w-full shrink-0">
        <AnimatePresence>
          {logs.length === 0 ? (
            <p className="text-muted-foreground/50 italic mt-4 text-center text-xs">
              {">"} Awaiting instructions...
            </p>
          ) : (
            logs.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2 pb-1.5 mb-1 border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground/40 shrink-0 select-none">[{log.time}]</span>
                <span className={getLogColor(log)}>{log.message}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TerminalPanel;
