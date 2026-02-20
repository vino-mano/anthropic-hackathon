import "@/index.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

function FinancialTrends() {
  const { output, isPending } = useToolInfo<"financial-trends">();

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Crunching your trends…
        </div>
      </div>
    );
  }

  const { periods } = output;
  const labels = periods.map((p) => p.date);

  const data = {
    labels,
    datasets: [
      {
        label: "Income",
        data: periods.map((p) => p.income),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Expenses",
        data: periods.map((p) => p.expenses),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Net Savings",
        data: periods.map((p) => p.net),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderDash: [5, 3],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.06)" },
        ticks: {
          callback: (value: string | number) => `£${Number(value).toLocaleString()}`,
          font: { size: 11 },
        },
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
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: £${(ctx.parsed.y ?? 0).toLocaleString()}`,
        },
      },
    },
  };

  const latestPeriod = periods[periods.length - 1];

  return (
    <div
      className="container"
      data-llm={`Financial trends: ${periods.map((p) => `${p.date}: income £${p.income.toLocaleString()}, expenses £${p.expenses.toLocaleString()}, net £${p.net.toLocaleString()}`).join("; ")}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="section-title">Financial Trends</span>
        {latestPeriod && (
          <span className="period-label">
            Latest: £{latestPeriod.net.toLocaleString()} net
          </span>
        )}
      </div>
      <div className="chart-container" style={{ minHeight: 200 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

export default FinancialTrends;

mountWidget(<FinancialTrends />);
