"use client";

import { useEffect, useState } from "react";
import { api, getToken, type ApiEnvelope } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

type Question = { _id: string; order: number; text: string; isActive: boolean };
type Option = { _id: string; order: number; optionText: string; score: number };

export default function AnswerOptionsPage() {
  const token = getToken();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get<ApiEnvelope<Question[]>>("/admin/questions", token);
      if (ok) setQuestions(data.data.filter((q: Question) => q.isActive));
    })();
  }, [token]);

  useEffect(() => {
    if (!selected) { setOptions(null); return; }
    (async () => {
      const { ok, data } = await api.get<ApiEnvelope<Option[]>>(`/admin/answer-options?questionId=${selected}`, token);
      if (ok) setOptions(data.data);
    })();
  }, [selected, token]);

  return (
    <>
      <PageHeader title="Answer Options" breadcrumb="Manage the answer options for each question" />
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="card text-sm" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
          Answer options vary by question type. Select a question to view its options, or edit them from the Questions page.
        </div>
        <div className="card flex flex-wrap gap-3 items-center">
          <label className="text-sm font-semibold self-center">Question:</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}
            className="border-2 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
            <option value="">— Select a question —</option>
            {questions.map((q) => (
              <option key={q._id} value={q._id}>Q{q.order}: {q.text.slice(0, 60)}{q.text.length > 60 ? "..." : ""}</option>
            ))}
          </select>
        </div>
        {options && (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Order</th><th>Option Text</th><th>Score</th></tr></thead>
              <tbody>
                {options.map((o) => (
                  <tr key={o._id}>
                    <td>{o.order}</td>
                    <td className="font-semibold">{o.optionText}</td>
                    <td><span className="badge badge-good">{o.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
