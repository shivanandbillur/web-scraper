import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export default function QueryHistoryModal({ isOpen, onClose }: Props) {
    const [queries, setQueries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetch("/api/queries")
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) setQueries(data);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="glass-panel w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative"
            >
                <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                        <Search className="w-4 h-4" /> AI Search Query History
                    </h2>
                    <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 custom-scrollbar text-xs bg-muted/20">
                    {loading ? (
                        <div className="text-center text-muted-foreground/50 italic py-10">Loading history...</div>
                    ) : queries.length === 0 ? (
                        <div className="text-center text-muted-foreground/50 italic py-10">No queries found in knowledge base.</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {queries.map((q) => (
                                <div key={q.id} className="p-3 border border-border bg-card hover:bg-muted/50 transition-colors flex justify-between gap-4">
                                    <span className="text-foreground/90 font-mono break-all tracking-tight leading-relaxed">
                                        {q.query_text}
                                    </span>
                                    <span className="text-muted-foreground/40 whitespace-nowrap text-[10px] uppercase font-semibold h-fit pt-0.5">
                                        {new Date(q.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
