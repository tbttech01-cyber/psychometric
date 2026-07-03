"use client";

import { useEffect, useRef } from "react";
import { Chart, ArcElement, DoughnutController, Legend, Tooltip } from "chart.js";

Chart.register(ArcElement, DoughnutController, Legend, Tooltip);

const COLORS = ["#CB1417", "#1F2937", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4"];

export default function DoughnutChart({ labels, data }: { labels: string[]; data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !labels.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: COLORS.slice(0, data.length), borderWidth: 2, borderColor: "#fff" }],
      },
      options: { responsive: true, cutout: "65%", plugins: { legend: { position: "right" } } },
    });
    return () => chartRef.current?.destroy();
  }, [labels, data]);

  if (!labels.length) return <p className="text-sm text-center py-8" style={{ color: "var(--tbt-muted)" }}>No data yet.</p>;
  return <canvas ref={canvasRef} />;
}
