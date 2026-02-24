import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Database, FileSpreadsheet, CheckCircle2, ExternalLink, Search, Trash2, Upload, X } from "lucide-react";
import type { LeadList, LeadData, LeadItem } from "@/types/leads";
import * as XLSX from 'xlsx';

type Props = {
  activeList: LeadList | undefined;
  onDeleteLeads?: (listId: string, urls: string[]) => void;
  onImportLeads?: (leads: LeadItem[], fileName: string) => void;
};

const DataTable = ({ activeList, onDeleteLeads, onImportLeads }: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportToExcel = () => {
    if (!activeList || activeList.leads.length === 0) return;

    const flattened = activeList.leads.map((lead) => {
      const data = (lead.data[0] || {}) as LeadData;
      return {
        "LinkedIn URL": lead.url,
        Name: data.name || "Unknown",
        "Job Title": data.jobTitle || "Unknown",
        Company: data.company || "Unknown",
        Location: data.location || "Unknown",
        Emails: data.emails ? data.emails.join(", ") : "",
        Bio: data.rawBio || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(flattened);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `${activeList.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportLeads) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        const leads: LeadItem[] = rows.map((row) => ({
          url: row["LinkedIn URL"] || row["url"] || row["URL"] || row["Profile"] || "",
          data: [{
            name: row["Name"] || row["name"] || "Unknown",
            jobTitle: row["Job Title"] || row["jobTitle"] || row["Title"] || "",
            company: row["Company"] || row["company"] || "",
            location: row["Location"] || row["location"] || "",
            emails: (row["Emails"] || row["Email"] || row["email"] || "").split(",").map((e: string) => e.trim()).filter(Boolean),
            rawBio: row["Bio"] || row["bio"] || "",
          }],
        }));

        onImportLeads(leads, file.name);
      } catch {
        alert("Failed to parse file. Ensure it has columns like Name, Company, etc.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const filteredLeads = activeList?.leads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const d = (lead.data[0] || {}) as LeadData;
    return (
      (d.name || "").toLowerCase().includes(q) ||
      (d.jobTitle || "").toLowerCase().includes(q) ||
      (d.company || "").toLowerCase().includes(q) ||
      (d.location || "").toLowerCase().includes(q) ||
      lead.url.toLowerCase().includes(q)
    );
  }) || [];

  const toggleSelect = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUrls.size === filteredLeads.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(filteredLeads.map((l) => l.url)));
    }
  };

  const handleBulkDelete = () => {
    if (!activeList || selectedUrls.size === 0 || !onDeleteLeads) return;
    onDeleteLeads(activeList.id, Array.from(selectedUrls));
    setSelectedUrls(new Set());
  };

  const handleDeleteOne = (url: string) => {
    if (!activeList || !onDeleteLeads) return;
    onDeleteLeads(activeList.id, [url]);
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-panel flex flex-col overflow-hidden h-full"
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 border border-border bg-muted">
            <Database className="w-4 h-4 text-foreground" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            {activeList ? activeList.name : "Lead Table"}
          </h2>
          {activeList && activeList.leads.length > 0 && (
            <span className="status-badge bg-foreground/10 text-foreground border-foreground/20">
              {activeList.leads.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv,.xlsx,.xls" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-border bg-muted hover:bg-accent px-3 py-1.5 text-xs font-bold text-foreground transition-all"
          >
            <Upload className="w-3.5 h-3.5" /> IMPORT
          </button>
          <button
            onClick={exportToExcel}
            disabled={!activeList || activeList.leads.length === 0}
            className="flex items-center gap-1.5 btn-primary-glow disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-bold transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> EXPORT
          </button>
        </div>
      </div>

      {/* Search + Bulk Actions Bar */}
      <div className="p-3 border-b border-border flex items-center gap-3 bg-card/50">
        <div className="flex-1 flex items-center gap-2 border border-border bg-input px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, title..."
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {selectedUrls.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 btn-danger-glow px-3 py-1.5 text-xs font-bold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> DELETE ({selectedUrls.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {!activeList || filteredLeads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 min-h-[400px]">
            <Database className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{searchQuery ? "No leads match your search." : "No leads extracted yet."}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery ? "Try a different search term" : "Run a search or import a file"}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 tracking-widest">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedUrls.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-foreground"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Profile</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Title & Company</th>
                <th className="px-3 py-3 font-medium">Emails</th>
                <th className="px-3 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, idx) => {
                const d = (lead.data[0] || {}) as LeadData;
                const cleanUrl = lead.url.split("?")[0];
                const shortUrl = cleanUrl
                  .replace("https://in.linkedin.com/in/", "")
                  .replace("https://www.linkedin.com/in/", "")
                  .replace("https://linkedin.com/in/", "");

                return (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUrls.has(lead.url)}
                        onChange={() => toggleSelect(lead.url)}
                        className="accent-foreground"
                      />
                    </td>
                    <td className="px-3 py-3 max-w-[140px]">
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground text-xs truncate block hover:underline flex items-center gap-1"
                        title={lead.url}
                      >
                        {shortUrl}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Extracted
                      </div>
                    </td>
                    <td className="px-3 py-3 text-foreground font-medium whitespace-nowrap">
                      {d.name || "N/A"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-foreground/90 font-medium line-clamp-1" title={d.jobTitle}>
                        {d.jobTitle || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {d.company || d.location || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {d.emails && d.emails.length > 0 ? (
                        <span className="status-badge bg-foreground/10 text-foreground border-foreground/20">
                          {d.emails[0]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDeleteOne(lead.url)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
};

export default DataTable;
