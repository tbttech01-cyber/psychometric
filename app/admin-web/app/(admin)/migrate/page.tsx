"use client";

// TEMPORARY page — one-time Question Set production migration trigger.
// Delete this page (and its Sidebar nav item) after the migration has run.
import { useState } from "react";
import { Database } from "lucide-react";
import { api, getToken } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ToastProvider";

type MigrateResult = {
  createdDefaultSet: boolean;
  questionCount: number;
  durationMinutes: number;
  codesAssigned: number;
  sessionsBackfilled: number;
};

export default function MigratePage() {
  const showToast = useToast();
  const token = getToken();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrateResult | null>(null);

  async function run() {
    setRunning(true);
    const { ok, data } = await api.post("/_migrate/question-sets", {}, token);
    setRunning(false);
    if (!ok) { showToast(data?.message || "Migration failed.", "error"); return; }
    setResult(data as MigrateResult);
    showToast("Migration completed successfully!", "success");
  }

  return (
    <>
      <PageHeader title="Run Question Set Migration" breadcrumb="One-time setup — safe to run once" />
      <main className="p-6">
        <div className="card max-w-xl space-y-4">
          <div className="flex items-start gap-3">
            <Database size={22} style={{ color: "var(--tbt-primary)" }} className="shrink-0 mt-1" />
            <div>
              <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>Set up Question Sets on the live database</h3>
              <p className="text-sm mt-1" style={{ color: "var(--tbt-muted)" }}>
                This creates a &ldquo;Default Set&rdquo; containing all current questions and assigns it to every access code,
                so existing users can start their assessment. It is safe to run — clicking more than once does no harm.
              </p>
            </div>
          </div>

          <button onClick={run} disabled={running} className="btn btn-primary">
            {running ? "Running migration…" : "Run Question Set Migration"}
          </button>

          {result && (
            <div className="card" style={{ background: "var(--tbt-primary-light)", borderColor: "#BBF7D0" }}>
              <p className="font-semibold mb-2" style={{ color: "var(--tbt-text)" }}>✅ Migration complete</p>
              <ul className="text-sm space-y-1" style={{ color: "var(--tbt-text)" }}>
                <li>Default Set {result.createdDefaultSet ? "created" : "already existed"} with <strong>{result.questionCount}</strong> questions ({result.durationMinutes} min timer)</li>
                <li>Access codes assigned to the Default Set: <strong>{result.codesAssigned}</strong></li>
                <li>In-progress sessions backfilled: <strong>{result.sessionsBackfilled}</strong></li>
              </ul>
              <p className="text-xs mt-3" style={{ color: "var(--tbt-muted)" }}>You can now tell your developer the migration is done — this page will be removed.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
