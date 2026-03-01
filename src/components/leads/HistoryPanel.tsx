import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Trash2, ChevronDown, ChevronUp, DollarSign, ScanLine, Users, Target, FileText } from "lucide-react";
import type { LeadList } from "@/types/leads";

type Props = {
  lists: LeadList[];
  currentListId: string | null;
  onSelectList: (id: string) => void;
  onDeleteList: (id: string) => void;
};

const StatusBadge = ({ status }: { status?: LeadList['status'] }) => {
  if (!status || status === 'done') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      ✓ Done
    </span>
  );
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
      ● Live
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
      ◼ Stopped
    </span>
  );
};

const HistoryPanel = ({ lists, currentListId, onSelectList, onDeleteList }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-panel flex flex-col"
      style={{ height: '340px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <div className="p-1.5 border border-border bg-muted">
          <History className="w-3.5 h-3.5 text-foreground" />
        </div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex-1">
          Search History
        </h2>
        <span className="text-[10px] text-muted-foreground font-mono">{lists.length} runs</span>
      </div>

      {/* Fixed-height scrollable list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <History className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">No previous runs yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {lists.map((list) => {
              const isActive = currentListId === list.id;
              const isExpanded = expandedId === list.id;

              return (
                <div key={list.id} className={`transition-colors ${isActive ? 'bg-foreground/8' : 'hover:bg-muted/30'}`}>
                  {/* Row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                    onClick={() => onSelectList(list.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${list.status === 'running' ? 'bg-blue-400 animate-pulse' :
                        list.status === 'stopped' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />

                    {/* Name + date */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate text-foreground leading-tight">
                        {list.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {new Date(list.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        {' · '}
                        <span className="text-foreground/70 font-medium">{list.leads.length} leads</span>
                        {list.costSpent !== undefined && list.costSpent > 0 && (
                          <span className="text-emerald-500/80"> · ${list.costSpent.toFixed(5)}</span>
                        )}
                      </span>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={(e) => toggleExpand(e, list.id)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Show session details"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                      title="Delete list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expanded session detail card */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-3 mb-3 p-3 bg-muted/40 border border-border/60 rounded space-y-2.5">
                          {/* Status + target */}
                          <div className="flex items-center justify-between">
                            <StatusBadge status={list.status} />
                            {list.targetCount && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Target className="w-3 h-3" />Goal: {list.targetCount}
                              </span>
                            )}
                          </div>

                          {/* Prompt */}
                          {list.prompt && (
                            <div className="flex gap-1.5">
                              <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                              <p className="text-[10px] text-foreground/80 leading-relaxed line-clamp-3" title={list.prompt}>
                                {list.prompt}
                              </p>
                            </div>
                          )}

                          {/* Stats grid */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center p-1.5 bg-background/40 rounded border border-border/40">
                              <ScanLine className="w-3 h-3 text-muted-foreground mb-0.5" />
                              <span className="text-[11px] font-bold text-foreground">{list.scanned ?? 0}</span>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Scanned</span>
                            </div>
                            <div className="flex flex-col items-center p-1.5 bg-background/40 rounded border border-border/40">
                              <Users className="w-3 h-3 text-emerald-500 mb-0.5" />
                              <span className="text-[11px] font-bold text-emerald-500">{list.leads.length}</span>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Kept</span>
                            </div>
                            <div className="flex flex-col items-center p-1.5 bg-background/40 rounded border border-border/40">
                              <span className="text-[10px] text-red-400 mb-0.5 font-bold">✕</span>
                              <span className="text-[11px] font-bold text-red-400">{list.rejected ?? 0}</span>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Rejected</span>
                            </div>
                          </div>

                          {/* Cost */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />This run cost
                            </span>
                            <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                              ${(list.costSpent ?? 0).toFixed(5)}
                            </span>
                          </div>
                          {list.allTimeCostAtEnd !== undefined && (
                            <div className="flex items-center justify-between -mt-1.5">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />All-time at end
                              </span>
                              <span className="text-[11px] font-bold text-amber-400 tabular-nums">
                                ${list.allTimeCostAtEnd.toFixed(5)}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default HistoryPanel;
