import "@/index.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function SpendingBreakdown() {
  const { output, isPending } = useToolInfo<"spending-breakdown">();

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Analysing your spending…
        </div>
      </div>
    );
  }

  const { categories, total, period } = output;

  const data = {
    labels: [""],
    datasets: categories.map((cat, i) => ({
      label: `${cat.name} (${cat.percentage}%)`,
      data: [cat.amount],
      backgroundColor: COLORS[i % COLORS.length],
      borderRadius: 2,
    })),
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          callback: (value: string | number) => `£${Number(value).toLocaleString()}`,
          font: { size: 11 },
        },
      },
      y: {
        stacked: true,
        display: false,
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          padding: 10,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: £${Number(ctx.raw).toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div
      className="container"
      data-llm={`Spending breakdown for ${period}: total £${total.toLocaleString()}. ${categories.map((c) => `${c.name} £${c.amount.toLocaleString()} (${c.percentage}%)`).join(", ")}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="section-title">Spending Breakdown</span>
        <span className="period-label">{period} — £{total.toLocaleString()} total</span>
      </div>
      <div className="chart-container" style={{ minHeight: 120 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}

export default SpendingBreakdown;

mountWidget(<SpendingBreakdown />);
