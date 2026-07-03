import type { LucideIcon } from "lucide-react";

export default function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  tone = "primary",
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sub?: string;
  tone?: "primary" | "success" | "danger";
}) {
  const valueColor =
    tone === "success" ? "#059669" : tone === "danger" ? "var(--tbt-danger)" : "var(--tbt-text)";

  return (
    <div className="card">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "var(--tbt-primary-light)", color: "var(--tbt-primary)" }}
      >
        <Icon size={20} strokeWidth={2} />
      </div>
      <p className="text-2xl font-extrabold leading-none" style={{ color: valueColor }}>
        {value}
      </p>
      <p className="text-sm font-semibold mt-2" style={{ color: "var(--tbt-text)" }}>
        {label}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--tbt-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
