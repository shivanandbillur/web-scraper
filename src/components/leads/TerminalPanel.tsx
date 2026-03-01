import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "lucide-react";
import type { LogEntry } from "@/types/leads";

type Props = {
  logs: LogEntry[];
  isRunning: boolean;
  extractedCount?: number;
  targetCount?: number;
  runStats?: { rawLeadsFound: number; rejected: number; kept: number; };
};

const TerminalPanel = ({ logs, isRunning, extractedCount, targetCount, runStats }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getAiState = () => {
    if (!isRunning) return { emoji: "😴", text: "Idle", color: "text-muted-foreground" };
    const rate = extractedCount ? (elapsed / extractedCount) : elapsed;
    if (rate > 25) return { emoji: "🥵", text: "Struggling...", color: "text-red-500" };
    if (rate > 15) return { emoji: "🤔", text: "Thinking...", color: "text-yellow-500" };
    if (extractedCount && extractedCount > 5) return { emoji: "🤓", text: "In the zone!", color: "text-green-500" };
    return { emoji: "🤖", text: "Searching...", color: "text-foreground" };
  };

  const aiLogic = getAiState();

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
      className="glass-panel p-5 flex flex-col gap-4 h-full overflow-hidden"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 border border-border bg-muted">
            <Terminal className="w-4 h-4 text-foreground" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Terminal</h2>
        </div>
        {isRunning && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold tracking-widest uppercase ${aiLogic.color}`}>
              {aiLogic.emoji} {aiLogic.text}
            </span>
            <span className="text-muted-foreground text-[10px]">|</span>
            {runStats !== undefined && (
              <span className="text-[10px] text-yellow-500 font-medium tracking-wide">
                Scanned: {runStats.rawLeadsFound}
              </span>
            )}
            {runStats !== undefined && (
              <span className="text-[10px] text-red-500 font-medium tracking-wide">
                Rejected: {runStats.rejected}
              </span>
            )}
            <span className="text-muted-foreground text-[10px]">|</span>
            {targetCount !== undefined && extractedCount !== undefined && (
              <span className="text-[10px] text-green-500 font-bold tracking-wide">
                Goal: {extractedCount}/{targetCount}
              </span>
            )}
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
            <span className="text-[10px] text-foreground font-medium uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto font-mono text-xs terminal-bg p-3 custom-scrollbar w-full min-h-0">
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
