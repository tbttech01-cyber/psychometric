"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ClipboardList, TrendingUp, FileOutput, ShieldCheck } from "lucide-react";
import { api, getToken, setStoredAdmin, setToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const showToast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "session-ended") {
      showToast("Your session has ended — please log in again.", "info");
      router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Valid email required.";
    if (!password) nextErrors.password = "Password required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    const { ok, data } = await api.post("/admin/login", { email, password });
    setLoading(false);
    if (!ok) {
      showToast(data.message || "Login failed.", "error");
      return;
    }
    setToken(data.token);
    setStoredAdmin(data.admin);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white"
        style={{ background: "linear-gradient(160deg, var(--tbt-primary), var(--tbt-primary-dark))" }}
      >
        <div>
          <div className="rounded-xl px-4 py-3 inline-block mb-4" style={{ background: "var(--tbt-sidebar-bg)" }}>
            <Image src="/tbt-logo.png" alt="Tamil Business Tribe" width={220} height={60} priority style={{ height: "auto", width: "220px" }} />
          </div>
          <p className="text-white/60 text-sm mt-1 tracking-wide uppercase">Administration Portal</p>
        </div>
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><ClipboardList size={18} /></span>
            <span className="font-semibold">Manage assessments</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><TrendingUp size={18} /></span>
            <span className="font-semibold">View results in real-time</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><FileOutput size={18} /></span>
            <span className="font-semibold">Export PDF &amp; CSV</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-black/20 rounded-full px-4 py-2 text-xs font-semibold">
            <ShieldCheck size={14} /> Restricted Access — Authorised Personnel Only
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: "var(--tbt-bg)" }}>
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="flex items-start justify-between mb-1">
            <h1 className="text-3xl font-extrabold" style={{ color: "var(--tbt-text)" }}>
              Admin Sign In
            </h1>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#F3F4F6", color: "var(--tbt-muted)" }}
            >
              v1.0
            </span>
          </div>
          <p className="text-sm mb-7" style={{ color: "var(--tbt-muted)" }}>
            Access your secure dashboard to manage assessments and business data.
          </p>

          <label className="block text-sm font-semibold mb-1.5" htmlFor="email">
            Email Address *
          </label>
          <div className="relative mb-1">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--tbt-muted)" }} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl pl-11 pr-4 py-3 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
            />
          </div>
          {errors.email && <p className="text-red-500 text-xs mb-2">{errors.email}</p>}

          <div className="flex items-center justify-between mt-4 mb-1.5">
            <label className="text-sm font-semibold" htmlFor="password">
              Password *
            </label>
            <span className="text-xs font-semibold" style={{ color: "var(--tbt-primary)" }}>
              Forgot Password?
            </span>
          </div>
          <div className="relative mb-1">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--tbt-muted)" }} />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-xl pl-11 pr-11 py-3 focus:outline-none"
              style={{ borderColor: "var(--tbt-border)" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--tbt-muted)" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mb-2">{errors.password}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-5">
            {loading ? "Checking..." : "Login"}
          </button>

          <p className="text-xs text-center mt-6 flex items-center justify-center gap-1.5" style={{ color: "var(--tbt-muted)" }}>
            <ShieldCheck size={14} /> Restricted access for platform administrators.
          </p>
        </form>
      </div>
    </div>
  );
}
