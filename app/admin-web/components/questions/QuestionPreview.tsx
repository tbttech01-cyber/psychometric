"use client";

import { Clock } from "lucide-react";
import type { Question, QCategory } from "@/lib/types";

export default function QuestionPreview({
  question,
  category,
}: {
  question: Partial<Question>;
  category?: QCategory;
}) {
  const options = question.options || [];
  const type = question.questionType;

  return (
    <div className="card" style={{ background: "var(--tbt-bg)" }}>
      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--tbt-muted)" }}>
        Candidate Preview
      </p>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {category && (
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
            style={{ background: category.color }}
          >
            {category.name}
          </span>
        )}
        {question.timeLimitSeconds ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--tbt-danger)" }}>
            <Clock size={13} /> {question.timeLimitSeconds}s
          </span>
        ) : null}
      </div>
      {question.instructionText && (
        <p className="text-xs italic mb-2" style={{ color: "var(--tbt-muted)" }}>{question.instructionText}</p>
      )}
      {question.imageUrl && (
        <img src={question.imageUrl} alt="" className="max-w-full rounded-lg mb-3" />
      )}
      {question.hasAudio && question.audioUrl && (
        <audio controls src={question.audioUrl} className="w-full mb-3" />
      )}
      <p className="font-semibold mb-3 text-sm leading-relaxed" style={{ color: "var(--tbt-text)" }}>
        {question.text || <span style={{ color: "var(--tbt-muted)" }}>Question text will appear here…</span>}
      </p>

      {options.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>Add options to preview them here.</p>
      ) : type === "MULTI_SELECT" ? (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="likert-option" style={{ pointerEvents: "none" }}>
              <input type="checkbox" disabled />
              <label>{o.optionText || <em>(empty)</em>}</label>
            </div>
          ))}
        </div>
      ) : type === "RANKING" ? (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--tbt-bg-alt, #f8fafc)", border: "1px solid var(--tbt-border)" }}>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0" style={{ background: "var(--tbt-primary)" }}>
                {i + 1}
              </span>
              <span className="text-sm">{o.optionText || <em>(empty)</em>}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i}>
              <div className="likert-option" style={{ pointerEvents: "none" }}>
                <input type="radio" disabled />
                <label>{o.optionText || <em>(empty)</em>}</label>
              </div>
              {type === "SITUATIONAL" && o.dimensionScores && Object.keys(o.dimensionScores).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 ml-6">
                  {Object.entries(o.dimensionScores).map(([dim, val]) => (
                    <span key={dim} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--tbt-primary-light)", color: "var(--tbt-primary-dark)" }}>
                      {dim}: {val}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
