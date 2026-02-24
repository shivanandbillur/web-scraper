import { motion } from "framer-motion";
import { Users, Search, Zap, Target } from "lucide-react";
import type { LeadList } from "@/types/leads";

type Props = {
  lists: LeadList[];
  activeList: LeadList | undefined;
  isRunning: boolean;
};

const StatsBar = ({ lists, activeList, isRunning }: Props) => {
  const totalLeads = lists.reduce((sum, l) => sum + l.leads.length, 0);
  const currentLeads = activeList?.leads.length || 0;

  const stats = [
    { label: "Total Leads", value: totalLeads, icon: Users },
    { label: "Current Run", value: currentLeads, icon: Target },
    { label: "Total Runs", value: lists.length, icon: Search },
    { label: "Status", value: isRunning ? "Active" : "Idle", icon: Zap },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-panel p-4 flex items-center gap-3"
        >
          <div className="p-2 border border-border bg-muted">
            <stat.icon className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsBar;
