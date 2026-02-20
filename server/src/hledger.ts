import { execSync } from "child_process";
import { join } from "path";

const JOURNAL_PATH = join(process.cwd(), "data", "sample.journal");

// --- Base functions ---

export function hledger(args: string): string {
  try {
    return execSync(`hledger -f "${JOURNAL_PATH}" ${args}`, {
      timeout: 5000,
      encoding: "utf-8",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`hledger command failed: ${message}`);
  }
}

export function hledgerJson(args: string): unknown {
  const output = hledger(`${args} -O json`);
  return JSON.parse(output);
}

// --- Helper ---

export function extractAmount(amounts: unknown[]): number {
  if (amounts.length === 0) return 0;
  const amt = amounts[0] as { aquantity: { floatingPoint: number } };
  return Math.round(amt.aquantity.floatingPoint * 100) / 100;
}

function dateToYearMonth(contents: string | number): string {
  if (typeof contents === "string") {
    // hledger v1.51+ uses { tag: "Exact", contents: "2025-09-01" }
    return contents.slice(0, 7);
  }
  // Older versions use Modified Julian Day: { tag: "ModifiedJulianDay", contents: 60588 }
  return new Date((contents - 2440587.5) * 86400000)
    .toISOString()
    .slice(0, 7);
}

// --- Types ---

export interface CategoryBreakdown {
  name: string;
  amount: number;
  percentage: number;
}

export interface SpendingBreakdownResult {
  categories: CategoryBreakdown[];
  total: number;
  period: string;
}

export interface PeriodTrend {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

export interface TrendsResult {
  periods: PeriodTrend[];
}

export interface FinancialSummaryResult {
  netWorth: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  cashflow: number;
  topExpenses: { name: string; amount: number }[];
}

// --- Parsers ---

export function getSpendingBreakdown(
  period: string,
  depth?: number,
  accountFilter?: string,
): SpendingBreakdownResult {
  const depthArg = depth ? `--depth ${depth}` : "";
  const account = accountFilter
    ? `"expenses:${accountFilter}"`
    : "expenses";
  const result = hledgerJson(
    `bal ${account} ${depthArg} -p "${period}" -S`,
  ) as [unknown[], unknown[]];

  const [rows, totals] = result;
  const total = Math.abs(
    extractAmount(totals as unknown[]),
  );

  const categories: CategoryBreakdown[] = (
    rows as [string, string, number, unknown[]][]
  ).map(([fullName, , , amounts]) => {
    const amount = Math.abs(extractAmount(amounts));
    return {
      name: fullName.replace(/^expenses:/, ""),
      amount,
      percentage:
        total > 0
          ? Math.round((amount / total) * 10000) / 100
          : 0,
    };
  });

  return { categories, total, period };
}

export function getFinancialTrends(
  period: string,
  interval: "monthly" | "weekly" | "quarterly",
): TrendsResult {
  const flagMap = { monthly: "M", weekly: "W", quarterly: "Q" };
  const flag = flagMap[interval];

  const result = hledgerJson(`is -${flag} -p "${period}"`) as {
    cbrTitle: string;
    cbrDates: { tag: string; contents: string | number }[][];
    cbrSubreports: [
      string,
      {
        prDates: unknown[];
        prRows: {
          prrName: string;
          prrAmounts: unknown[][];
          prrTotal: unknown[];
          prrAverage: unknown[];
        }[];
        prTotals: unknown;
      },
      boolean,
    ][];
    cbrTotals: {
      prrName: string;
      prrAmounts: unknown[][];
      prrTotal: unknown[];
      prrAverage: unknown[];
    };
  };

  const dates = result.cbrDates.map(
    (pair) => dateToYearMonth(pair[0].contents),
  );

  // Revenue subreport (index 0), expenses subreport (index 1)
  const revenueSubreport = result.cbrSubreports[0][1];
  const expensesSubreport = result.cbrSubreports[1][1];

  const periods: PeriodTrend[] = dates.map((date, i) => {
    // Sum all revenue rows for this period column
    let income = 0;
    for (const row of revenueSubreport.prRows) {
      income += extractAmount(row.prrAmounts[i] ?? []);
    }
    // Revenue amounts are already positive (inverted flag)
    income = Math.abs(Math.round(income * 100) / 100);

    // Sum all expense rows for this period column
    let expenses = 0;
    for (const row of expensesSubreport.prRows) {
      expenses += extractAmount(row.prrAmounts[i] ?? []);
    }
    expenses = Math.abs(Math.round(expenses * 100) / 100);

    const net = Math.round((income - expenses) * 100) / 100;

    return { date, income, expenses, net };
  });

  return { periods };
}

export function getFinancialSummary(
  period?: string,
): FinancialSummaryResult {
  const periodArg = period ? `-p "${period}"` : "";

  // Balance sheet for net worth
  const bsResult = hledgerJson(`bs ${periodArg}`) as {
    cbrTotals: {
      prrAmounts: unknown[][];
      prrTotal: unknown[];
    };
  };

  // Income statement for income/expenses
  const isResult = hledgerJson(`is ${periodArg}`) as {
    cbrSubreports: [
      string,
      {
        prRows: {
          prrName: string;
          prrAmounts: unknown[][];
          prrTotal: unknown[];
        }[];
        prTotals: {
          prrAmounts: unknown[][];
          prrTotal: unknown[];
        };
      },
      boolean,
    ][];
    cbrTotals: {
      prrTotal: unknown[];
    };
  };

  // Balance for top expenses
  const balResult = hledgerJson(
    `bal expenses --depth 2 ${periodArg} -S`,
  ) as [unknown[], unknown[]];

  // Net worth from bs totals
  const netWorth = extractAmount(bsResult.cbrTotals.prrTotal);

  // Income and expenses from is subreports
  const revenueReport = isResult.cbrSubreports[0][1];
  const expensesReport = isResult.cbrSubreports[1][1];
  const totalIncome = Math.abs(
    extractAmount(revenueReport.prTotals.prrTotal),
  );
  const totalExpenses = Math.abs(
    extractAmount(expensesReport.prTotals.prrTotal),
  );

  const savingsRate =
    totalIncome > 0
      ? Math.round(
          ((totalIncome - totalExpenses) / totalIncome) * 10000,
        ) / 100
      : 0;

  const cashflow =
    Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Top 5 expenses from bal
  const [rows] = balResult;
  const topExpenses = (
    rows as [string, string, number, unknown[]][]
  )
    .slice(0, 5)
    .map(([fullName, , , amounts]) => ({
      name: fullName.replace(/^expenses:/, ""),
      amount: Math.abs(extractAmount(amounts)),
    }));

  return {
    netWorth,
    totalIncome,
    totalExpenses,
    savingsRate,
    cashflow,
    topExpenses,
  };
}
