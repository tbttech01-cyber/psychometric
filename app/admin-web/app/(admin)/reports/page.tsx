"use client";

import { useEffect, useState } from "react";
import { Users, CheckCircle2, BarChart3, KeyRound } from "lucide-react";
import { api, getToken, downloadFile } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import DoughnutChart from "@/components/DoughnutChart";
import type { DashboardData } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

const LEVELS = [
  { key: "Excellent", color: "#10B981" },
  { key: "Good", color: "#3B82F6" },
  { key: "Average", color: "#F59E0B" },
  { key: "Needs Improvement", color: "#EF4444" },
];

export default function ReportsPage() {
  const showToast = useToast();
  const token = getToken();
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [levelCounts, setLevelCounts] = useState<{ key: string; color: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [dashRes, ...levelResArr] = await Promise.all([
        api.get<DashboardData>("/admin/dashboard", token),
        ...LEVELS.map((l) => api.get(`/admin/results?level=${encodeURIComponent(l.key)}&limit=1`, token)),
      ]);
      if (!dashRes.ok) { showToast("Failed to load report data.", "error"); return; }
      setDash(dashRes.data);
      setLevelCounts(LEVELS.map((l, i) => ({ ...l, count: levelResArr[i].ok ? levelResArr[i].data.total : 0 })));
    })();
  }, [token, showToast]);

  const maxCount = Math.max(1, ...levelCounts.map((l) => l.count));

  async function doExport(kind: "pdf" | "csv") {
    const date = new Date().toISOString().split("T")[0];
    const { ok, message } = await downloadFile(`/admin/export/${kind}`, token, `tbt_results_${date}.${kind}`);
    if (!ok) showToast(message || "Export failed.", "error");
  }

  return (
    <>
      <PageHeader
        title="Reports"
        breadcrumb="Export and review assessment results"
        actions={
          <div className="flex gap-2">
            <button onClick={() => doExport("pdf")} className="btn btn-primary btn-sm">Export Full Report (PDF)</button>
            <button onClick={() => doExport("csv")} className="btn btn-outline btn-sm">Export Full Report (CSV)</button>
          </div>
        }
      />
      <main className="p-6 space-y-4">
        {!dash ? (
          <div className="text-center py-20"><div className="spinner mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} value={dash.cards.totalUsersRegistered} label="Registered Users" />
              <StatCard icon={CheckCircle2} value={dash.cards.totalAssessmentsCompleted} label="Completed Assessments" />
              <StatCard icon={BarChart3} value={`${dash.cards.averageScore}%`} label="Average Score" />
              <StatCard icon={KeyRound} value={dash.cards.activeSharedCodes} label="Active Access Codes" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-bold mb-4" style={{ color: "var(--tbt-primary)" }}>Results by Level</h3>
                <div className="space-y-3">
                  {levelCounts.map((l) => (
                    <div key={l.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold">{l.key}</span><span>{l.count}</span>
                      </div>
                      <div className="cat-bar"><div className="cat-bar-fill" style={{ width: `${(l.count / maxCount) * 100}%`, background: l.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3 className="font-bold mb-4" style={{ color: "var(--tbt-primary)" }}>Business Distribution</h3>
                <DoughnutChart labels={dash.pieChart.labels} data={dash.pieChart.data} />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
