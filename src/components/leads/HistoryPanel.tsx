import { motion } from "framer-motion";
import { History, Trash2 } from "lucide-react";
import type { LeadList } from "@/types/leads";

type Props = {
  lists: LeadList[];
  currentListId: string | null;
  onSelectList: (id: string) => void;
  onDeleteList: (id: string) => void;
};

const HistoryPanel = ({ lists, currentListId, onSelectList, onDeleteList }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex-1 glass-panel p-5 flex flex-col gap-4 min-h-[220px]"
    >
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className="p-2 border border-border bg-muted">
          <History className="w-4 h-4 text-foreground" />
        </div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">History</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {lists.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center mt-6">
            No previous runs.
          </p>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              onClick={() => onSelectList(list.id)}
              className={`flex items-center justify-between p-3 cursor-pointer transition-all duration-200 border ${
                currentListId === list.id
                  ? 'bg-foreground/10 border-foreground/20'
                  : 'bg-transparent border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate text-foreground">{list.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(list.date).toLocaleString()} • {list.leads.length} leads
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default HistoryPanel;
