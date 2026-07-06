"use client";

import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

type Question = { _id: string; order: number; text: string; isActive: boolean };
type Option = { _id: string; order: number; label: string; marks: number };

export default function AnswerOptionsPage() {
  const token = getToken();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get("/admin/questions", token);
      if (ok) setQuestions(data.data.filter((q: Question) => q.isActive));
    })();
  }, [token]);

  useEffect(() => {
    if (!selected) { setOptions(null); return; }
    (async () => {
      const { ok, data } = await api.get(`/admin/answer-options?questionId=${selected}`, token);
      if (ok) setOptions(data.data);
    })();
  }, [selected, token]);

  return (
    <>
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--tbt-primary)" }}>Answer Options</h1>
      </header>
      <main className="p-6 space-y-4">
        <div className="card text-sm" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
          All questions use a 5-point Likert scale. Select a question to view its options, or edit them from the Questions page.
        </div>
        <div className="card flex gap-3">
          <label className="text-sm font-semibold self-center">Question:</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}
            className="border-2 rounded-lg px-3 py-2 flex-1 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
            <option value="">— Select a question —</option>
            {questions.map((q) => (
              <option key={q._id} value={q._id}>Q{q.order}: {q.text.slice(0, 60)}{q.text.length > 60 ? "..." : ""}</option>
            ))}
          </select>
        </div>
        {options && (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Order</th><th>Label</th><th>Marks</th></tr></thead>
              <tbody>
                {options.map((o) => (
                  <tr key={o._id}>
                    <td>{o.order}</td>
                    <td className="font-semibold">{o.label}</td>
                    <td><span className="badge badge-good">{o.marks}</span></td>
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
