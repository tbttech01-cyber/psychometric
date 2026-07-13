"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, removeToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/PageHeader";

export default function SettingsPage() {
  const showToast = useToast();
  const router = useRouter();
  const token = getToken();

  const [email, setEmail] = useState("");
  const [lastLogin, setLastLogin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [duration, setDuration] = useState<number | "">("");
  const [savingDuration, setSavingDuration] = useState(false);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api.get("/admin/profile", token);
      if (!ok) return;
      setEmail(data.admin.email);
      setLastLogin(data.admin.lastLoginAt ? new Date(data.admin.lastLoginAt).toLocaleString() : "This is your first login");
    })();

    (async () => {
      const { ok, data } = await api.get("/admin/settings", token);
      if (ok && data.data) {
        setDuration(data.data.assessment_duration_minutes);
      }
    })();
  }, [token]);

  async function changePassword() {
    if (!currentPassword || !newPassword) return showToast("All fields are required.", "error");
    if (newPassword.length < 6) return showToast("New password must be at least 6 characters.", "error");
    if (newPassword !== confirmPassword) return showToast("New passwords do not match.", "error");

    const { ok, data } = await api.post("/admin/change-password", { currentPassword, newPassword }, token);
    if (!ok) { showToast(data.message || "Failed to change password.", "error"); return; }
    showToast("Password changed. Please log in again.", "success");
    setTimeout(() => {
      removeToken();
      router.push("/login");
    }, 1500);
  }

  async function saveSettings() {
    if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
      return showToast("Please enter a valid duration in minutes.", "error");
    }
    setSavingDuration(true);
    const { ok, data } = await api.post("/admin/settings", { assessment_duration_minutes: Number(duration) }, token);
    setSavingDuration(false);
    if (!ok) {
      showToast(data.message || "Failed to update settings.", "error");
      return;
    }
    showToast("Settings updated successfully.", "success");
  }

  return (
    <>
      <PageHeader title="Settings" breadcrumb="Manage your admin profile and assessment settings" />
      <main className="p-6 space-y-4 max-w-2xl">
        <div className="card">
          <h3 className="font-bold mb-3" style={{ color: "var(--tbt-primary)" }}>Admin Profile</h3>
          <div className="text-sm space-y-1">
            <p><span style={{ color: "var(--tbt-muted)" }}>Email:</span> <span className="font-semibold">{email}</span></p>
            <p><span style={{ color: "var(--tbt-muted)" }}>Last Login:</span> <span className="font-semibold">{lastLogin}</span></p>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-3" style={{ color: "var(--tbt-primary)" }}>Change Password</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
            <button onClick={changePassword} className="btn btn-primary">Change Password</button>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-3" style={{ color: "var(--tbt-primary)" }}>Assessment Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Assessment Time Limit (in minutes)</label>
              <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
                className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
            </div>
            <button onClick={saveSettings} disabled={savingDuration} className="btn btn-primary">
              {savingDuration ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
