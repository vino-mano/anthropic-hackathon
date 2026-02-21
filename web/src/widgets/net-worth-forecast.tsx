import "@/index.css";

import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Scenario = "pessimistic" | "realistic" | "optimistic";

const scenarioConfig: Record<Scenario, { label: string; color: string; bg: string; description: string }> = {
  pessimistic: {
    label: "Pessimistic",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
    description: "Spending creeps up — saving only 40% of current pace",
  },
  realistic: {
    label: "Realistic",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.08)",
    description: "Current pace continues — same income and spending patterns",
  },
  optimistic: {
    label: "Optimistic",
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.08)",
    description: "Tighter budget — saving 60% more than current pace",
  },
};

function NetWorthForecast() {
  const { output, isPending } = useToolInfo<"net-worth-forecast">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const [scenario, setScenario] = useState<Scenario>("realistic");
  const isFullscreen = displayMode === "fullscreen";

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Projecting your future...
        </div>
      </div>
    );
  }

  if ("_error" in output) {
    return (
      <div className="container">
        <span className="section-title">Net Worth Forecast</span>
        <div className="widget-error">{(output as any)._error}</div>
      </div>
    );
  }

  const { historical, currentNetWorth, avgMonthlySavings, forecasts } = output;
  const forecastPoints = forecasts[scenario];
  const projectedEnd = forecastPoints[forecastPoints.length - 1]?.netWorth ?? currentNetWorth;
  const change = projectedEnd - currentNetWorth;
  const config = scenarioConfig[scenario];

  // Build chart data: historical + forecast
  const allLabels = [
    ...historical.map((p) => p.date),
    ...forecastPoints.map((p) => p.date),
  ];

  const historicalData = historical.map((p) => p.netWorth);
  const forecastData = new Array(historical.length).fill(null);
  // Connect forecast to last historical point
  if (historical.length > 0) {
    forecastData[historical.length - 1] = historical[historical.length - 1].netWorth;
  }
  forecastData.push(...forecastPoints.map((p) => p.netWorth));

  const data = {
    labels: allLabels,
    datasets: [
      {
        label: "Historical",
        data: historicalData,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#3b82f6",
        borderWidth: 2,
      },
      {
        label: `Forecast (${config.label})`,
        data: forecastData,
        borderColor: config.color,
        backgroundColor: config.bg,
        fill: true,
        borderDash: [6, 4],
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: config.color,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.06)" },
        ticks: {
          callback: (value: string | number) => `\u00A3${Number(value).toLocaleString()}`,
          font: { size: 11 },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { boxWidth: 12, padding: 10, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: \u00A3${Number(ctx.raw).toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Net worth forecast: Current \u00A3${currentNetWorth.toLocaleString()}. ${config.label} projection in 9 months: \u00A3${projectedEnd.toLocaleString()} (${change >= 0 ? "+" : ""}\u00A3${change.toLocaleString()}).`}
    >
      <div className="widget-header">
        <span className="section-title">Net Worth Forecast</span>
        <button
          className="expand-btn"
          onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
        >
          {isFullscreen ? "Close" : "Expand"}
        </button>
      </div>

      {/* Metric cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Current Net Worth</span>
          <span className="metric-value">{"\u00A3"}{currentNetWorth.toLocaleString()}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Projected (9 mo)</span>
          <span className={`metric-value ${projectedEnd >= currentNetWorth ? "positive" : "negative"}`}>
            {"\u00A3"}{projectedEnd.toLocaleString()}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Change</span>
          <span className={`metric-value ${change >= 0 ? "positive" : "negative"}`}>
            {change >= 0 ? "+" : ""}{"\u00A3"}{change.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Scenario toggle */}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {(Object.entries(scenarioConfig) as [Scenario, typeof config][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setScenario(key)}
            style={{
              flex: 1,
              padding: "0.35rem 0.5rem",
              border: `1.5px solid ${scenario === key ? cfg.color : "var(--color-border)"}`,
              borderRadius: "0.375rem",
              background: scenario === key ? cfg.bg : "transparent",
              color: scenario === key ? cfg.color : "var(--color-text-muted)",
              fontFamily: "var(--font)",
              fontSize: "0.7rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-container" style={{ minHeight: isFullscreen ? 400 : 250 }}>
        <Line data={data} options={options} />
      </div>

      {/* Scenario description */}
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textAlign: "center" }}>
        {config.description} | Avg monthly savings: {"\u00A3"}{avgMonthlySavings.toLocaleString()}
      </div>
    </div>
  );
}

export default NetWorthForecast;

mountWidget(<NetWorthForecast />);
