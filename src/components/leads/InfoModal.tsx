import { motion, AnimatePresence } from "framer-motion";
import { X, Info, Shield, Search, Brain, Database, Filter } from "lucide-react";
import { useState } from "react";

export default function InfoModal() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-2.5 border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="How It Works"
            >
                <Info className="w-5 h-5" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl p-6 custom-scrollbar"
                        >
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                                <div className="p-2 border border-border bg-muted">
                                    <Info className="w-6 h-6 text-foreground" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">System Architecture</h2>
                                    <p className="text-xs text-muted-foreground">How the Lead Engine Works</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <section>
                                    <div className="flex items-center gap-2 mb-2 text-foreground">
                                        <Brain className="w-4 h-4 text-blue-500" />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">1. AI Query Generation</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                                        The system uses OpenAI to translate your natural language prompt into specialized X-Ray Search Queries. It intentionally appends negative footprint strings (e.g. <code>-"USA" -"Canada"</code>) to strictly filter location at the search level, bypassing broad results. It also generates variations to cover synonyms of job titles.
                                    </p>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-2 text-foreground">
                                        <Search className="w-4 h-4 text-orange-500" />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">2. Bypassing Search Limits</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                                        Instead of scraping LinkedIn directly (which triggers CAPTCHAs and account bans), the system dynamically searches Yahoo Directory pages via Playwright headless browsers. It extracts public LinkedIn data natively indexed by search engines. To avoid search engine blocks, it injects randomized human-like delays (2-4 seconds) between page transitions.
                                    </p>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-2 text-foreground">
                                        <Filter className="w-4 h-4 text-purple-500" />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">3. Filtering ICP (Ideal Customer Profile)</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6 space-y-2 leading-relaxed">
                                        <span className="block">• <strong>Strict Domain Rule:</strong> It inherently parses the domain. Any foreign mirror variant (like <code>ca.linkedin.com</code> or <code>uk.linkedin.com</code>) is immediately dropped. Only strictly <code>in.linkedin.com</code> Indian domains pass through.</span>
                                        <span className="block">• <strong>Text Negations:</strong> It parses the snippet descriptions and forcefully removes anyone whose bio specifies unwanted countries (USA, UAE, Australia, etc.).</span>
                                        <span className="block">• <strong>AI Dynamic Exclusions:</strong> If toggled on, the AI infers anti-persona roles (e.g., student, intern, vendor) and tests regex logic against the prospect's bio, filtering out unqualified hits on the fly.</span>
                                    </p>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-2 text-foreground">
                                        <Shield className="w-4 h-4 text-green-500" />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">4. Native Deduplication</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                                        A heavy verification step guarantees zero overlap. It compares parsed URLs against:
                                        <br />(1) Your internal SQLite database of previously scraped leads.
                                        <br />(2) Any contacts already inside <code>leadsc - sheet1 (1).csv</code>.
                                        <br />(3) Any URLs you pasted/uploaded manually inside the UI.
                                    </p>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-2 text-foreground">
                                        <Database className="w-4 h-4 text-white" />
                                        <h3 className="font-bold uppercase tracking-wider text-sm">5. Export Mechanism</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                                        Once leads pass the pipeline, they are displayed strictly in the UI table. The results can be instantly exported into structured CSV format for your outbound email sequences via the Export button.
                                    </p>
                                </section>
                            </div>

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
