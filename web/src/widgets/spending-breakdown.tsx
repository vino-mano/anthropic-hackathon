import "@/index.css";

import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo, useCallTool } from "../helpers.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function SpendingBreakdown() {
  const { output, isPending, input } = useToolInfo<"spending-breakdown">();
  const { callToolAsync, data: drillData, isPending: isDrilling } = useCallTool("spending-breakdown");
  const [displayMode, setDisplayMode] = useDisplayMode();
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const isFullscreen = displayMode === "fullscreen";

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

  if ("_error" in output) {
    return (
      <div className="container">
        <span className="section-title">Spending Breakdown</span>
        <div className="widget-error">{(output as any)._error}</div>
      </div>
    );
  }

  // Use drill-down data if available, otherwise top-level
  const activeDrill = drillCategory && drillData?.structuredContent && !("_error" in drillData.structuredContent);
  const activeData = activeDrill
    ? (drillData!.structuredContent as typeof output)
    : output;

  const { months, categoryTotals, grandTotal, period } = activeData;

  const handleDrillDown = async (categoryName: string) => {
    setDrillCategory(categoryName);
    await callToolAsync({
      period: input?.period ?? period,
      depth: 3,
      category: categoryName,
    });
  };

  const handleDrillUp = () => {
    setDrillCategory(null);
  };

  // Use category totals (sorted by amount) to determine which categories to show
  const topCategories = categoryTotals.slice(0, 8).map((c) => c.name);

  // Month labels for x-axis
  const labels = months.map((m) => m.date);

  // One dataset per category, with values per month
  const datasets = topCategories.map((catName, i) => ({
    label: catName,
    data: months.map((m) => {
      const found = m.categories.find((c) => c.name === catName);
      return found ? found.amount : 0;
    }),
    backgroundColor: COLORS[i % COLORS.length],
    borderRadius: 3,
  }));

  const data = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event: unknown, elements: { datasetIndex: number }[]) => {
      if (elements.length > 0 && !drillCategory) {
        const catName = topCategories[elements[0].datasetIndex];
        if (catName) handleDrillDown(catName);
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        stacked: true,
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
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: £${Number(ctx.raw).toLocaleString()}`,
          footer: () => drillCategory ? "" : "Click to drill down",
        },
      },
    },
  };

  const summaryText = categoryTotals
    .slice(0, 5)
    .map((c) => `${c.name} £${c.amount.toLocaleString()} (${c.percentage}%)`)
    .join(", ");

  const title = drillCategory
    ? `Spending: ${drillCategory}`
    : "Spending Breakdown";

  return (
    <div
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Monthly spending breakdown for ${period}: grand total £${grandTotal.toLocaleString()} across ${months.length} months. Top categories: ${summaryText}`}
    >
      <div className="widget-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          {drillCategory && (
            <button
              className="expand-btn"
              onClick={handleDrillUp}
              style={{ marginRight: "0.25rem" }}
            >
              ← Back
            </button>
          )}
          <span className="section-title">{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="period-label">{period} — £{grandTotal.toLocaleString()} total</span>
          <button
            className="expand-btn"
            onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
          >
            {isFullscreen ? "Close" : "Expand"}
          </button>
        </div>
      </div>

      {isDrilling ? (
        <div className="loading" style={{ minHeight: 250 }}>
          <div className="loading-spinner" />
          Loading {drillCategory} breakdown…
        </div>
      ) : (
        <div
          className="chart-container"
          style={{ minHeight: isFullscreen ? 400 : 250, cursor: drillCategory ? "default" : "pointer" }}
        >
          <Bar data={data} options={options} />
        </div>
      )}

      {!isDrilling && !drillCategory && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {categoryTotals.slice(0, 6).map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => handleDrillDown(cat.name)}
              style={{
                padding: "0.3rem 0.6rem",
                border: `1.5px solid ${COLORS[i % COLORS.length]}`,
                borderRadius: "0.375rem",
                background: "transparent",
                color: "var(--color-text)",
                fontFamily: "var(--font)",
                fontSize: "0.7rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: COLORS[i % COLORS.length],
                  display: "inline-block",
                }}
              />
              {cat.name}
              <span style={{ color: "var(--color-text-muted)" }}>
                £{cat.amount.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {isFullscreen && !isDrilling && (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Category</th>
              {months.map((m) => (
                <th key={m.date} className="num">{m.date}</th>
              ))}
              <th className="num">Total</th>
              <th className="num">%</th>
            </tr>
          </thead>
          <tbody>
            {categoryTotals.map((cat) => (
              <tr
                key={cat.name}
                onClick={() => !drillCategory && handleDrillDown(cat.name)}
                style={{ cursor: drillCategory ? "default" : "pointer" }}
              >
                <td style={{ textTransform: "capitalize" }}>{cat.name}</td>
                {months.map((m) => {
                  const found = m.categories.find((c) => c.name === cat.name);
                  return (
                    <td key={m.date} className="num">
                      {found ? `£${found.amount.toLocaleString()}` : "—"}
                    </td>
                  );
                })}
                <td className="num" style={{ fontWeight: 600 }}>£{cat.amount.toLocaleString()}</td>
                <td className="num">{cat.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default SpendingBreakdown;

mountWidget(<SpendingBreakdown />);
