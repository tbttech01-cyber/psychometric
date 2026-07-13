"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, BarChart3, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { levelBadgeClass } from "@/lib/badges";
import type { Result } from "@/lib/types";

// A fixed palette looks better for small counts, but the category/dimension
// count is admin-configurable and unbounded, so it must not run out or repeat.
const BAR_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#10B981", "#F97316", "#06B6D4"];
function barColor(i: number, total: number) {
  if (total <= BAR_COLORS.length) return BAR_COLORS[i];
  return `hsl(${Math.round((i * 360) / total)}, 65%, 55%)`;
}

const LEVEL_TONE: Record<string, "success" | "danger" | "primary"> = {
  Excellent: "success",
  Good: "success",
  Average: "primary",
  "Needs Improvement": "danger",
};

export default function ResultDetailPage() {
  const params = useParams<{ id: string }>();
  const showToast = useToast();
  const token = getToken();

  const [result, setResult] = useState<Result | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get<{ data: Result; message?: string }>(`/admin/results/${params.id}`, token);
      if (!ok) {
        setNotFound(true);
        showToast(data?.message || "Failed to load result.", "error");
        return;
      }
      setResult(data.data);
    })();
  }, [params.id, token, showToast]);

  if (notFound) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <Link href="/results" className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: "var(--tbt-primary)" }}>
          <ArrowLeft size={16} /> Back to Results
        </Link>
        <p className="mt-6 text-sm" style={{ color: "var(--tbt-muted)" }}>This result could not be found — it may have been deleted.</p>
      </main>
    );
  }

  if (!result) {
    return <div className="text-center py-20"><div className="spinner mx-auto" /></div>;
  }

  const r = result;
  const categories = Object.entries(r.categoryPercentages || {});
  const dimensions = Object.entries(r.dimensionPercentages || {});
  const strong = r.strongDimensions || [];
  const weak = r.weakDimensions || [];
  const composites = ([
    ["Aptitude", r.aptitudeScore],
    ["Personality", r.personalityScore],
    ["Business Mindset", r.businessMindsetScore],
    ["Financial Awareness", r.financialAwarenessScore],
  ] as [string, number | undefined][]).filter((c): c is [string, number] => c[1] != null);
  const recommendations = r.recommendations && r.recommendations.length
    ? r.recommendations
    : (r.recommendedBusiness || []).map((business) => ({ business, explanation: "" }));
  const hasCounts = r.correctCount != null || r.wrongCount != null || r.skippedCount != null;

  return (
    <>
      <PageHeader
        title={r.userId?.name || "Assessment Result"}
        breadcrumb={`${r.userId?.email || ""}${r.userId?.sharedCode ? ` · Code: ${r.userId.sharedCode}` : ""} · Taken ${new Date(r.createdAt).toLocaleString()}`}
        actions={
          <Link href="/results" className="btn btn-outline btn-sm">
            <ArrowLeft size={16} /> Back to Results
          </Link>
        }
      />
      <main className="p-6 pb-20 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Trophy} value={`${r.percentage}%`} label="Overall Score" tone={LEVEL_TONE[r.level] || "primary"} />
          <StatCard icon={BarChart3} value={`${r.totalMarks}/${r.maxScore}`} label="Total Marks" />
          {hasCounts && <StatCard icon={CheckCircle2} value={r.correctCount ?? 0} label="Correct" tone="success" />}
          {hasCounts && <StatCard icon={XCircle} value={r.wrongCount ?? 0} label="Wrong" tone="danger" />}
        </div>
        {hasCounts && r.skippedCount != null && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={MinusCircle} value={r.skippedCount} label="Skipped" />
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold" style={{ color: "var(--tbt-primary)" }}>Result Summary</h3>
            <span className={levelBadgeClass(r.level)}>{r.level}</span>
          </div>
          <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>{r.explanation}</p>
          {r.highestCategory?.length > 0 && (
            <p className="text-xs mt-3" style={{ color: "var(--tbt-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--tbt-text)" }}>Top Category:</span> {r.highestCategory.join(", ")}
            </p>
          )}
        </div>

        {composites.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {composites.map(([label, v]) => (
              <div key={label} className="card text-center">
                <p className="text-2xl font-extrabold" style={{ color: "var(--tbt-primary)" }}>{v}%</p>
                <p className="text-xs font-semibold mt-1" style={{ color: "var(--tbt-muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold mb-4" style={{ color: "var(--tbt-primary)" }}>Category Breakdown</h3>
            <div className="space-y-3">
              {categories.map(([name, pct], i) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{name}</span>
                    <span style={{ color: "var(--tbt-muted)" }}>{pct}%</span>
                  </div>
                  <div className="cat-bar"><div className="cat-bar-fill" style={{ width: `${pct}%`, background: barColor(i, categories.length) }} /></div>
                </div>
              ))}
            </div>
          </div>

          {dimensions.length > 0 && (
            <div className="card">
              <h3 className="font-bold mb-4" style={{ color: "var(--tbt-primary)" }}>Dimension Breakdown</h3>
              <div className="space-y-3">
                {dimensions.map(([name, pct], i) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{name}</span>
                      <span style={{ color: "var(--tbt-muted)" }}>{pct}%</span>
                    </div>
                    <div className="cat-bar"><div className="cat-bar-fill" style={{ width: `${pct}%`, background: barColor(i, dimensions.length) }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(strong.length > 0 || weak.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-success, #059669)" }}>Strong Dimensions</h3>
              <div className="flex flex-wrap gap-2">
                {strong.map((d) => (
                  <span key={d} className="inline-block px-3 py-1 rounded-full text-sm font-semibold" style={{ background: "#D1FAE5", color: "#065F46" }}>
                    {d}{r.dimensionPercentages?.[d] != null ? ` (${r.dimensionPercentages[d]}%)` : ""}
                  </span>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-danger)" }}>Weak Dimensions</h3>
              <div className="flex flex-wrap gap-2">
                {weak.map((d) => (
                  <span key={d} className="inline-block px-3 py-1 rounded-full text-sm font-semibold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                    {d}{r.dimensionPercentages?.[d] != null ? ` (${r.dimensionPercentages[d]}%)` : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-primary)" }}>Business Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg p-4" style={{ background: "rgba(203,20,23,0.06)", border: "1px solid rgba(203,20,23,0.2)" }}>
                <p className="font-bold text-sm mb-1" style={{ color: "var(--tbt-primary)" }}>{rec.business}</p>
                {rec.explanation && <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>{rec.explanation}</p>}
              </div>
            ))}
          </div>
        </div>

        {(r.improvementAreas || []).length > 0 && (
          <div className="card">
            <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-primary)" }}>Areas to Strengthen</h3>
            <div className="space-y-4">
              {r.improvementAreas.map((area, i) => (
                <div key={i} className="rounded-lg p-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                  <p className="font-bold text-sm mb-1" style={{ color: "#92400E" }}>{area.category} ({area.score}%)</p>
                  <p className="text-sm" style={{ color: "#78350F" }}>{area.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
