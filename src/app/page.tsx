"use client";

import { Globe } from "lucide-react";
import { motion } from "framer-motion";
import ConfigPanel from "@/components/leads/ConfigPanel";
import HistoryPanel from "@/components/leads/HistoryPanel";
import TerminalPanel from "@/components/leads/TerminalPanel";
import DataTable from "@/components/leads/DataTable";
import StatsBar from "@/components/leads/StatsBar";
import SettingsPanel from "@/components/leads/SettingsPanel";
import InfoModal from "@/components/leads/InfoModal";
import { useLeadEngine } from "@/hooks/useLeadEngine";

export default function Home() {
  const engine = useLeadEngine();

  return (
    <main className="min-h-screen p-4 md:p-6 flex flex-col gap-4 w-full max-w-[1800px] mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between border-b border-border pb-4 pt-2"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 border border-border bg-muted">
            <Globe className="w-7 h-7 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text tracking-tight">
              LEAD ENGINE
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5 uppercase tracking-widest">
              AI-Powered Search & Extraction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <InfoModal />
          <SettingsPanel
            settings={engine.settings}
            setSettings={engine.setSettings}
            onClearLogs={engine.clearLogs}
            onClearAllData={engine.clearAllData}
          />
        </div>
      </motion.header>

      {/* Stats */}
      <StatsBar lists={engine.lists} activeList={engine.activeList} isRunning={engine.isRunning} />

      {/* Main Grid — all columns fixed-height, no overflow push */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ height: 'calc(100vh - 180px)', minHeight: '640px' }}>

        {/* Left: Config + History — scrollable column */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-0.5">
          <ConfigPanel
            naturalQuery={engine.naturalQuery}
            setNaturalQuery={engine.setNaturalQuery}
            numResults={engine.numResults}
            setNumResults={engine.setNumResults}
            enableDynamicExclusions={engine.enableDynamicExclusions}
            setEnableDynamicExclusions={engine.setEnableDynamicExclusions}
            manualExclusionsText={engine.manualExclusionsText}
            setManualExclusionsText={engine.setManualExclusionsText}
            spendLimit={engine.spendLimit}
            setSpendLimit={engine.setSpendLimit}
            currentSpend={engine.currentSpend}
            allTimeCost={engine.allTimeCost}
            isRunning={engine.isRunning}
            onStart={engine.startScraping}
            onStop={engine.stopScraping}
          />
          {/* History panel — fixed-height box, scrolls internally */}
          <HistoryPanel
            lists={engine.lists}
            currentListId={engine.currentListId}
            onSelectList={engine.setCurrentListId}
            onDeleteList={engine.deleteList}
          />
        </div>

        {/* Middle: Terminal — fixed height */}
        <div className="lg:col-span-3 overflow-hidden">
          <TerminalPanel
            logs={engine.logs}
            isRunning={engine.isRunning}
            extractedCount={engine.activeList?.leads?.length || 0}
            targetCount={engine.numResults}
            runStats={engine.runStats}
          />
        </div>

        {/* Right: Data Table — fixed height, scrolls internally */}
        <div className="lg:col-span-6 overflow-hidden" style={{ height: '100%' }}>
          <DataTable
            activeList={engine.activeList}
            onDeleteLeads={engine.deleteLeads}
            onImportLeads={engine.importLeads}
          />
        </div>
      </div>
    </main>
  );
}
