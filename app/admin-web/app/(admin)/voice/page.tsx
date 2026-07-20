"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken, API_BASE_URL } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";

type Voice = { id: string; label: string };
type Voices = { en: Voice[]; ta: Voice[] };
type Config = { enabled: boolean; voiceEn: string; voiceTa: string; ratePct: number; pitchHz: number; voiceExplanation: string; explanationRatePct: number };
type AudioStatus = "none" | "ready" | "stale";
type Row = {
  _id: string; order: number; text: string; status: AudioStatus; voice: string | null;
  hasExplanation?: boolean; explanationIsTanglish?: boolean;
  explanationStatus?: AudioStatus | null; explanationVoice?: string | null;
};

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
const STATUS_BADGE: Record<AudioStatus, { text: string; cls: string }> = {
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
  const [busy, setBusy] = useState<string | null>(null); // questionId currently generating (question audio)
  const [busyExp, setBusyExp] = useState<string | null>(null); // questionId generating explanation audio
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

  // --- Spoken-explanation audio (the Tanglish/Tamil "Play" fix) ---
  async function generateExplanation(id: string): Promise<boolean> {
    setBusyExp(id);
    const { ok, data } = await api.post<{ message?: string }>(`/admin/tts/questions/${id}/generate-explanation`, {}, token);
    setBusyExp(null);
    if (!ok) { showToast(data?.message || "Generation failed.", "error"); return false; }
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, explanationStatus: "ready" } : r)));
    return true;
  }

  async function generateAllExplanations() {
    const targets = rows.filter((r) => r.hasExplanation && r.explanationStatus !== "ready");
    if (!targets.length) return showToast("All explanations already have up-to-date audio.", "info");
    cancelBulk.current = false;
    setBulk({ done: 0, total: targets.length });
    let done = 0;
    for (const r of targets) {
      if (cancelBulk.current) break;
      await generateExplanation(r._id);
      done += 1;
      setBulk({ done, total: targets.length });
    }
    setBulk(null);
    showToast(cancelBulk.current ? `Stopped after ${done}.` : `Generated ${done} explanation clip(s).`, "success");
  }

  async function previewExplanation(id: string) {
    try {
      if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null; }
      const res = await fetch(`${API_BASE_URL}/admin/tts/questions/${id}/preview-explanation`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return showToast("No explanation audio to preview — generate it first.", "error");
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
        <main className="p-6 space-y-4 max-w-6xl mx-auto"><p style={{ color: "var(--tbt-muted)" }}>Loading…</p></main>
      </>
    );
  }

  const readyCount = rows.filter((r) => r.status === "ready").length;

  return (
    <>
      <PageHeader title="Voice / Audio" breadcrumb="Free neural text-to-speech read aloud on the candidate assessment" />

      <main className="p-6 space-y-4 max-w-6xl mx-auto">
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
                {rows.map((r, i) => (
                  <tr key={r._id}>
                    <td>{i + 1}</td>
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

        {/* Spoken-explanation audio — device-independent Tamil/Tanglish audio */}
        {rows.some((r) => r.hasExplanation) && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-bold" style={{ color: "var(--tbt-primary)" }}>Spoken explanation audio</h3>
                <p className="text-xs" style={{ color: "var(--tbt-muted)" }}>
                  {rows.filter((r) => r.hasExplanation && r.explanationStatus === "ready").length}/{rows.filter((r) => r.hasExplanation).length} explanations have up-to-date audio.
                </p>
              </div>
              {bulk ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Generating {bulk.done}/{bulk.total}…</span>
                  <button onClick={() => { cancelBulk.current = true; }} className="btn btn-outline btn-sm">Stop</button>
                </div>
              ) : (
                <button onClick={generateAllExplanations} className="btn btn-primary btn-sm">Generate all</button>
              )}
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--tbt-muted)" }}>
              Generates Tamil neural audio for each question&apos;s spoken explanation (Tanglish is converted to Tamil first).
              This plays on <strong>every</strong> candidate device — no Tamil voice needs to be installed.
            </p>

            {/* Dedicated voice + speed for the Tanglish/Tamil explanation audio */}
            <div className="rounded-xl p-3 mb-3" style={{ background: "#F9FAFB", border: "1px solid var(--tbt-border)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--tbt-text)" }}>Explanation voice (Tanglish / Tamil)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold mb-1">Voice</label>
                  <select value={config.voiceExplanation} onChange={(e) => setConfig({ ...config, voiceExplanation: e.target.value })}
                    className="border-2 rounded-lg px-3 py-2 w-full" style={{ borderColor: "var(--tbt-border)" }}>
                    {voices.ta.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Speed</label>
                  <select value={config.explanationRatePct} onChange={(e) => setConfig({ ...config, explanationRatePct: Number(e.target.value) })}
                    className="border-2 rounded-lg px-3 py-2 w-full" style={{ borderColor: "var(--tbt-border)" }}>
                    {SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <button onClick={saveSettings} disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save voice"}</button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--tbt-muted)" }}>
                After changing the voice or speed, click <strong>Regenerate</strong> below (or <strong>Generate all</strong>) to apply it to the audio.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.filter((r) => r.hasExplanation).map((r, i) => {
                    const st = (r.explanationStatus || "none") as AudioStatus;
                    return (
                      <tr key={r._id}>
                        <td>{i + 1}</td>
                        <td className="max-w-md truncate" title={r.text}>{r.text}</td>
                        <td>{r.explanationIsTanglish ? <span className="badge badge-good">Tanglish</span> : <span className="badge badge-inactive">Plain</span>}</td>
                        <td><span className={`badge ${STATUS_BADGE[st].cls}`}>{STATUS_BADGE[st].text}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => generateExplanation(r._id)} disabled={busyExp === r._id || !!bulk} className="btn btn-outline btn-sm">
                              {busyExp === r._id ? "…" : st === "none" ? "Generate" : "Regenerate"}
                            </button>
                            <button onClick={() => previewExplanation(r._id)} disabled={st === "none"} className="btn btn-outline btn-sm">▶ Preview</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
