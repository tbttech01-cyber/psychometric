"use client";

import { Trash2, Info, AlertTriangle } from "lucide-react";

export default function ConfirmModal({
  title,
  message,
  warning,
  confirmLabel = "Yes, Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = true,
}: {
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: danger ? "#FEE2E2" : "#EFF6FF", color: danger ? "#DC2626" : "#2563EB" }}
          >
            {danger ? <Trash2 size={24} /> : <Info size={24} />}
          </div>
          <h3 className="text-lg font-bold" style={{ color: "var(--tbt-text)" }}>
            {title}
          </h3>
        </div>
        <p className="text-sm text-center mb-4" style={{ color: "var(--tbt-muted)" }}>
          {message}
        </p>
        {warning && (
          <div
            className="text-xs rounded-lg p-3 mb-4 flex items-start gap-2"
            style={{ background: "#FEF3C7", color: "#92400E" }}
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className={`btn ${danger ? "btn-danger" : "btn-primary"} w-full`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="btn btn-outline w-full">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
