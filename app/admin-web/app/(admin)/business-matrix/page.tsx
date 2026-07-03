"use client";

import { useEffect, useState, useCallback } from "react";
import { Grid3x3, Plus } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";
import ConfirmModal from "@/components/ConfirmModal";

type QType = { _id: string; name: string; order: number };
type Cell = { _id: string; rowTypeId: string; colTypeId: string; businessName: string; rating: number; isActive: boolean };

export default function BusinessMatrixPage() {
  const showToast = useToast();
  const token = getToken();

  const [types, setTypes] = useState<QType[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [completion, setCompletion] = useState({ configured: 0, total: 0 });

  const [editing, setEditing] = useState<{ row: QType; col: QType; cell: Cell | null } | null>(null);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(3);
  const [formActive, setFormActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Cell | null>(null);

  const load = useCallback(async () => {
    const { ok, data } = await api.get("/admin/business-matrix", token);
    if (!ok) { showToast("Failed to load business matrix.", "error"); return; }
    setTypes(data.types);
    setCells(data.cells);
    setCompletion(data.completion);
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  function cellFor(rowId: string, colId: string) {
    return cells.find((c) => c.rowTypeId === rowId && c.colTypeId === colId) || null;
  }

  function openCell(row: QType, col: QType) {
    const cell = cellFor(row._id, col._id);
    setEditing({ row, col, cell });
    setFormName(cell?.businessName || "");
    setFormRating(cell?.rating || 3);
    setFormActive(cell?.isActive ?? true);
  }

  async function save() {
    if (!editing) return;
    if (!formName.trim()) { showToast("Business/role name is required.", "error"); return; }
    if (editing.cell) {
      const { ok, data } = await api.put(`/admin/business-matrix/${editing.cell._id}`, { businessName: formName, rating: formRating, isActive: formActive }, token);
      if (!ok) { showToast(data.message || "Update failed.", "error"); return; }
      showToast("Cell updated!", "success");
    } else {
      const { ok, data } = await api.post("/admin/business-matrix", {
        rowTypeId: editing.row._id, colTypeId: editing.col._id, businessName: formName, rating: formRating,
      }, token);
      if (!ok) { showToast(data.message || "Create failed.", "error"); return; }
      showToast("Cell added!", "success");
    }
    setEditing(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { ok, data } = await api.delete(`/admin/business-matrix/${deleteTarget._id}`, token);
    setDeleteTarget(null);
    setEditing(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("Cell removed.", "success");
    load();
  }

  const pct = completion.total ? Math.round((completion.configured / completion.total) * 100) : 0;

  return (
    <>
      <PageHeader title="Business Matrix Management" breadcrumb={`Manage the ${types.length}×${types.length} recommendation matrix`} />
      <main className="p-6 space-y-4">
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold" style={{ color: "var(--tbt-text)" }}>Matrix Configuration Completion</h3>
            <span className="text-sm font-semibold" style={{ color: "var(--tbt-muted)" }}>
              {pct}% ({completion.configured}/{completion.total} cells)
            </span>
          </div>
          <div className="cat-bar">
            <div className="cat-bar-fill" style={{ width: `${pct}%`, background: "var(--tbt-primary)" }} />
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: "0.5rem" }}>
            <thead>
              <tr>
                <th></th>
                {types.map((c) => (
                  <th key={c._id} className="text-xs font-bold uppercase px-2 pb-2" style={{ color: "var(--tbt-muted)", minWidth: 150 }}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((row, ri) => (
                <tr key={row._id}>
                  <td className="text-xs font-bold uppercase pr-3 align-top" style={{ color: "var(--tbt-muted)", minWidth: 130 }}>
                    {row.name}
                  </td>
                  {types.map((col, ci) => {
                    const cell = cellFor(row._id, col._id);
                    const nodeId = `B${ri}${ci}`;
                    return (
                      <td key={col._id} className="align-top">
                        <button
                          onClick={() => openCell(row, col)}
                          className="block text-left w-full rounded-xl p-3 h-full"
                          style={{
                            border: cell ? "1px solid var(--tbt-border)" : "1.5px dashed var(--tbt-border)",
                            background: cell ? "var(--tbt-card)" : "#FAFAFA",
                            minHeight: 92,
                          }}
                        >
                          {cell ? (
                            <>
                              <div className="flex justify-between items-start gap-1">
                                <span className="text-sm font-semibold leading-tight">{cell.businessName}</span>
                                <span
                                  className="w-2 h-2 rounded-full mt-1 shrink-0"
                                  style={{ background: cell.isActive ? "#10B981" : "#D1D5DB" }}
                                />
                              </div>
                              <div className="flex gap-0.5 mt-2">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <span
                                    key={n}
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: n <= cell.rating ? "var(--tbt-primary)" : "var(--tbt-border)" }}
                                  />
                                ))}
                              </div>
                              <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--tbt-muted)" }}>NODE ID: {nodeId}</p>
                            </>
                          ) : (
                            <span className="flex flex-col items-center justify-center gap-1 h-full text-xs font-semibold" style={{ color: "var(--tbt-muted)" }}>
                              <Plus size={16} /> Add Cell
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-box p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-1">
              <Grid3x3 size={20} style={{ color: "var(--tbt-primary)" }} />
              <h3 className="text-lg font-bold" style={{ color: "var(--tbt-text)" }}>
                {editing.cell ? "Edit" : "Add"} Cell
              </h3>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--tbt-muted)" }}>
              {editing.row.name} &times; {editing.col.name}
            </p>

            <label className="block text-sm font-semibold mb-1.5">Business / Role Name *</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Strategic Branding"
              className="border rounded-xl px-3.5 py-2.5 w-full focus:outline-none mb-4"
              style={{ borderColor: "var(--tbt-border)" }}
            />

            <label className="block text-sm font-semibold mb-1.5">Rating</label>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFormRating(n)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: n <= formRating ? "var(--tbt-primary)" : "#F3F4F6",
                    color: n <= formRating ? "white" : "var(--tbt-muted)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {editing.cell && (
              <label className="flex items-center gap-2 mb-4 text-sm font-semibold">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="w-4 h-4" />
                Active
              </label>
            )}

            <div className="flex gap-2">
              <button onClick={save} className="btn btn-primary">Save</button>
              <button onClick={() => setEditing(null)} className="btn btn-outline">Cancel</button>
              {editing.cell && (
                <button onClick={() => setDeleteTarget(editing.cell)} className="btn btn-danger ml-auto">Delete</button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Remove This Cell?"
          message={`This deletes the "${deleteTarget.businessName}" recommendation for this category pair. It will show as unconfigured again.`}
          confirmLabel="Yes, Remove"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
