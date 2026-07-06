"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Trophy, CheckSquare, Search } from "lucide-react";
import { api, getToken, downloadFile } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { levelBadgeClass } from "@/lib/badges";

type ResultRow = {
  _id: string;
  totalMarks: number;
  percentage: number;
  level: string;
  highestCategory?: string[];
  createdAt: string;
  userId?: { name: string; email: string; sharedCode: string };
};

function pageWindow(current: number, total: number): (number | "...")[] {
  const pages: (number | "...")[] = [];
  const add = (p: number | "...") => pages.push(p);
  const window = 1;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= current - window && p <= current + window)) add(p);
    else if (pages[pages.length - 1] !== "...") add("...");
  }
  return pages;
}

export default function ResultsPage() {
  const showToast = useToast();
  const token = getToken();

  const [rows, setRows] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [excellentCount, setExcellentCount] = useState(0);

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [business, setBusiness] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const buildQS = useCallback((forPage = page) => {
    const p = new URLSearchParams();
    p.set("page", String(forPage));
    p.set("limit", "25");
    p.set("sortBy", sortBy);
    if (search) p.set("search", search);
    if (level) p.set("level", level);
    if (business) p.set("business", business);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p.toString();
  }, [page, sortBy, search, level, business, dateFrom, dateTo]);

  const load = useCallback(async () => {
    const { ok, data } = await api.get(`/admin/results?${buildQS()}`, token);
    if (!ok) { showToast("Failed to load.", "error"); return; }
    setRows(data.data);
    setTotal(data.total);
    setPages(data.pages || 1);
  }, [buildQS, token, showToast]);

  const loadStats = useCallback(async () => {
    const { ok, data } = await api.get("/admin/results?level=Excellent&limit=1", token);
    if (ok) setExcellentCount(data.total);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  function applyFilters() { setPage(1); }
  function clearFilters() {
    setSearch(""); setLevel(""); setBusiness(""); setDateFrom(""); setDateTo("");
    setPage(1);
  }

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r._id)) : new Set());
  }

  const exportQS = buildQS().replace(/page=\d+&?/, "").replace(/limit=\d+&?/, "");
  const selectedIds = [...selected].join(",");

  async function doExport(kind: "pdf" | "csv", qs: string) {
    const date = new Date().toISOString().split("T")[0];
    const { ok, message } = await downloadFile(`/admin/export/${kind}?${qs}`, token, `tbt_results_${date}.${kind}`);
    if (!ok) showToast(message || "Export failed.", "error");
  }

  return (
    <>
      <PageHeader
        title="Assessment Results"
        breadcrumb="Review, filter, and export psychometric performance metrics"
        actions={
          <div className="flex gap-2">
            <button onClick={() => doExport("pdf", exportQS)} className="btn btn-primary btn-sm">Export PDF</button>
            <button onClick={() => doExport("csv", exportQS)} className="btn btn-outline btn-sm">Export CSV</button>
          </div>
        }
      />
      <main className="p-6 pb-20 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={BarChart3} value={total} label="Total Results" />
          <StatCard icon={Trophy} value={excellentCount} label="Excellent" tone="success" />
          <StatCard icon={CheckSquare} value={selected.size} label="Selected for Export" />
        </div>

        <div className="card flex flex-wrap gap-3 items-end">
          <div><label className="block text-xs font-semibold mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--tbt-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / Email / Code"
                className="border rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
          </div>
          <div><label className="block text-xs font-semibold mb-1">Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All</option>
              <option>Excellent</option><option>Good</option><option>Average</option><option>Needs Improvement</option>
            </select></div>
          <div><label className="block text-xs font-semibold mb-1">Business Type</label>
            <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Consulting"
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} /></div>
          <div><label className="block text-xs font-semibold mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} /></div>
          <div><label className="block text-xs font-semibold mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} /></div>
          <div><label className="block text-xs font-semibold mb-1">Sort By</label>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="border rounded-xl px-3.5 py-2.5 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="date-desc">Latest Date</option>
              <option value="date-asc">Oldest Date</option>
              <option value="score-desc">Highest Score</option>
              <option value="score-asc">Lowest Score</option>
            </select></div>
          <button onClick={applyFilters} className="btn btn-primary btn-sm">Apply</button>
          <button onClick={clearFilters} className="btn btn-outline btn-sm">Clear</button>
        </div>

        <div className="card overflow-x-auto">
          <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>{total} results found</p>
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={(e) => toggleAll(e.target.checked)} /></th>
                <th>Name</th><th>Email</th><th>Code</th><th>Score</th><th>%</th><th>Level</th><th>Top Category</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td><input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleRow(r._id)} /></td>
                  <td>{r.userId?.name || ""}</td>
                  <td className="text-xs">{r.userId?.email || ""}</td>
                  <td><span className="font-mono text-xs">{r.userId?.sharedCode || ""}</span></td>
                  <td className="font-bold">{r.totalMarks}/200</td>
                  <td>{r.percentage}%</td>
                  <td><span className={levelBadgeClass(r.level)}>{r.level}</span></td>
                  <td className="text-xs">{(r.highestCategory || []).join(", ")}</td>
                  <td className="text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-center items-center gap-1 mt-4 flex-wrap">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline btn-sm">‹</button>
            {pageWindow(page, pages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-2 text-sm" style={{ color: "var(--tbt-muted)" }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)} className={`btn btn-sm ${p === page ? "btn-primary" : "btn-outline"}`}>{p}</button>
              )
            )}
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline btn-sm">›</button>
          </div>
        </div>
      </main>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-[248px] bg-white border-t px-6 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-semibold">{selected.size} result(s) selected</span>
          <div className="flex gap-2">
            <button onClick={() => doExport("pdf", `ids=${selectedIds}`)} className="btn btn-primary btn-sm">Export Selected PDF</button>
            <button onClick={() => doExport("csv", `ids=${selectedIds}`)} className="btn btn-outline btn-sm">Export Selected CSV</button>
            <button onClick={() => setSelected(new Set())} className="btn btn-outline btn-sm">Clear Selection</button>
          </div>
        </div>
      )}
    </>
  );
}
