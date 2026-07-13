"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, CheckCircle2, BarChart3, KeyRound, Trophy, AlertTriangle } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import BarChart from "@/components/BarChart";
import DoughnutChart from "@/components/DoughnutChart";
import { levelBadgeClass } from "@/lib/badges";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const showToast = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    (async () => {
      const token = getToken();
      const { ok, data } = await api.get<DashboardData>("/admin/dashboard", token);
      if (!ok) { showToast("Failed to load dashboard.", "error"); return; }
      setData(data);
    })();
  }, [showToast]);

  return (
    <>
      <PageHeader title="Dashboard" breadcrumb={dateStr} />
      <main className="p-6">
        {!data ? (
          <div className="text-center py-20"><div className="spinner mx-auto" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} value={data.cards.totalUsersRegistered} label="Registered Users" />
              <StatCard icon={CheckCircle2} value={data.cards.totalAssessmentsCompleted} label="Completed" />
              <StatCard icon={BarChart3} value={`${data.cards.averageScore}%`} label="Avg Score" />
              <StatCard icon={KeyRound} value={data.cards.activeSharedCodes} label="Active Codes" />
              <StatCard icon={Trophy} value={`${data.cards.highestScore}%`} label="Highest Score" tone="success" />
              <StatCard icon={AlertTriangle} value={`${data.cards.lowestScore}%`} label="Lowest Score" tone="danger" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-bold mb-4" style={{ color: "var(--tbt-text)" }}>Assessments (Last 30 Days)</h3>
                <BarChart labels={data.barChart.labels.map((d) => d.slice(5))} data={data.barChart.data} />
              </div>
              <div className="card">
                <h3 className="font-bold mb-4" style={{ color: "var(--tbt-text)" }}>Business Distribution</h3>
                <DoughnutChart labels={data.pieChart.labels} data={data.pieChart.data} />
              </div>
            </div>

            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>Recent Results</h3>
                <Link href="/results" className="text-sm font-semibold" style={{ color: "var(--tbt-primary)" }}>View all →</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Code</th><th>Score</th><th>Level</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {data.recentResults.map((r) => (
                      <tr key={r._id}>
                        <td>{r.userId?.name || ""}</td>
                        <td>{r.userId?.email || ""}</td>
                        <td><span className="font-mono text-xs">{r.userId?.sharedCode || ""}</span></td>
                        <td className="font-bold">{r.totalMarks}/{r.maxScore}</td>
                        <td><span className={levelBadgeClass(r.level)}>{r.level}</span></td>
                        <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
