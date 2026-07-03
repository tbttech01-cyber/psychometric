"use client";

import { useEffect, useRef } from "react";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export default function BarChart({ labels, data, label = "Assessments" }: { labels: string[]; data: number[]; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label, data, backgroundColor: "#CB1417", borderRadius: 4 }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [labels, data, label]);

  return <canvas ref={canvasRef} />;
}
