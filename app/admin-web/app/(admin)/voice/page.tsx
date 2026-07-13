"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken, API_BASE_URL } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";

type Voice = { id: string; label: string };
type Voices = { en: Voice[]; ta: Voice[] };
type Config = { enabled: boolean; voiceEn: string; voiceTa: string; ratePct: number; pitchHz: number };
type Row = { _id: string; order: number; text: string; status: "none" | "ready" | "stale"; voice: string | null };

const SPEEDS = [
  { label: "Slower", value: -15 },
  { label: "Slow (recommended)", value: -6 },
  { label: "Normal", value: 0 },
  { label: "Fast", value: 10 },
];
const PITCHES = [
  { label: "Lower", value: -10 },
  { label: "Normal", value: 0 },
  { label: "Higher", value: 10 },
];
const STATUS_BADGE: Record<Row["status"], { text: string; cls: string }> = {
  ready: { text: "Ready", cls: "badge-excellent" },
  stale: { text: "Outdated", cls: "badge-average" },
  none: { text: "Not generated", cls: "badge-needs" },
};

export default function VoicePage() {
  const showToast = useToast();
  const token = getToken();

  const [voices, setVoices] = useState<Voices>({ en: [], ta: [] });
  const [config, setConfig] = useState<Config | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // questionId currently generating
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const cancelBulk = useRef(false);
  const previewAudio = useRef<HTMLAudioElement | null>(null);

  const loadStatus = useCallback(async () => {
    const { ok, data } = await api.get<{ data: Row[] }>("/admin/tts/status", token);
    if (ok) setRows(data.data);
  }, [token]);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get<{ config: Config; voices: Voices }>("/admin/tts/settings", token);
      if (ok) { setConfig(data.config); setVoices(data.voices); }
    })();
    loadStatus();
  }, [token, loadStatus]);

  async function saveSettings() {
    if (!config) return;
    setSaving(true);
    const { ok, data } = await api.put<{ config: Config; message?: string }>("/admin/tts/settings", config, token);
    setSaving(false);
    if (!ok) return showToast(data?.message || "Failed to save.", "error");
    setConfig(data.config);
    showToast("Voice settings saved.", "success");
  }

  async function generateOne(id: string): Promise<boolean> {
    setBusy(id);
    const { ok, data } = await api.post<{ message?: string }>(`/admin/tts/questions/${id}/generate`, {}, token);
    setBusy(null);
    if (!ok) { showToast(data?.message || "Generation failed.", "error"); return false; }
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, status: "ready" } : r)));
    return true;
  }

  async function generateAll() {
    const targets = rows.filter((r) => r.status !== "ready");
    if (!targets.length) return showToast("All questions already have up-to-date audio.", "info");
    cancelBulk.current = false;
    setBulk({ done: 0, total: targets.length });
    let done = 0;
    for (const r of targets) {
      if (cancelBulk.current) break;
      await generateOne(r._id);
      done += 1;
      setBulk({ done, total: targets.length });
    }
    setBulk(null);
    showToast(cancelBulk.current ? `Stopped after ${done}.` : `Generated ${done} voice clip(s).`, "success");
  }

  async function preview(id: string) {
    try {
      if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null; }
      const res = await fetch(`${API_BASE_URL}/admin/tts/questions/${id}/preview`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return showToast("No audio to preview — generate it first.", "error");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      previewAudio.current = audio;
      audio.play();
    } catch { showToast("Could not play preview.", "error"); }
  }

  if (!config) {
    return (
      <>
        <PageHeader title="Voice / Audio" breadcrumb="Free neural text-to-speech read aloud on the candidate assessment" />
        <main className="p-6 md:p-8 space-y-5 max-w-4xl mx-auto"><p style={{ color: "var(--tbt-muted)" }}>Loading…</p></main>
      </>
    );
  }

  const readyCount = rows.filter((r) => r.status === "ready").length;

  return (
    <>
      <PageHeader title="Voice / Audio" breadcrumb="Free neural text-to-speech read aloud on the candidate assessment" />

      <main className="p-6 md:p-8 space-y-5 max-w-4xl mx-auto">
        {/* Settings */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold" style={{ color: "var(--tbt-primary)" }}>Voice settings</h3>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
              Neural voice {config.enabled ? "on" : "off"}
            </label>
          </div>
          <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>
            When off, candidates hear their browser&apos;s built-in voice instead of the generated neural audio.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">English voice</label>
              <select value={config.voiceEn} onChange={(e) => setConfig({ ...config, voiceEn: e.target.value })}
                className="border-2 rounded-lg px-3 py-2 w-full" style={{ borderColor: "var(--tbt-border)" }}>
                {voices.en.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Tamil voice</label>
              <select value={config.voiceTa} onChange={(e) => setConfig({ ...config, voiceTa: e.target.value })}
                className="border-2 rounded-lg px-3 py-2 w-full" style={{ borderColor: "var(--tbt-border)" }}>
                {voices.ta.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Speed</label>
              <select value={config.ratePct} onChange={(e) => setConfig({ ...config, ratePct: Number(e.target.value) })}
                className="border-2 rounded-lg px-3 py-2 w-full" style={{ borderColor: "var(--tbt-border)" }}>
                {SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Pitch</label>
              <select value={config.pitchHz} onChange={(e) => setConfig({ ...config, pitchHz: Number(e.target.value) })}
                className="border-2 rounded-lg px-3 py-2 w-full" style={{ borderColor: "var(--tbt-border)" }}>
                {PITCHES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveSettings} disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save settings"}</button>
            <span className="text-xs" style={{ color: "var(--tbt-muted)" }}>
              After changing the voice or speed, re-generate audio below to apply it.
            </span>
          </div>
        </div>

        {/* Generation */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold" style={{ color: "var(--tbt-primary)" }}>Question audio</h3>
              <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>{readyCount}/{rows.length} questions have up-to-date audio.</p>
            </div>
            {bulk ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Generating {bulk.done}/{bulk.total}…</span>
                <button onClick={() => { cancelBulk.current = true; }} className="btn btn-outline btn-sm">Stop</button>
              </div>
            ) : (
              <button onClick={generateAll} className="btn btn-primary btn-sm">Generate all</button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>#</th><th>Question</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.order}</td>
                    <td className="max-w-md truncate" title={r.text}>{r.text}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status].cls}`}>{STATUS_BADGE[r.status].text}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => generateOne(r._id)} disabled={busy === r._id || !!bulk} className="btn btn-outline btn-sm">
                          {busy === r._id ? "…" : r.status === "none" ? "Generate" : "Regenerate"}
                        </button>
                        <button onClick={() => preview(r._id)} disabled={r.status === "none"} className="btn btn-outline btn-sm">▶ Preview</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
