# Design Plan Review Findings

**Date:** 2026-02-20
**Source:** Deep review of `2026-02-20-hledger-financial-insights-design.md`

---

## Critical Issues

### 1. hledger JSON output has two distinct shapes
- `hledger bal` → plain 2-element array: `[rows, totals]` where each row is `[fullName, displayName, depth, amounts]`
- `hledger is/bs/cf` → compound balance report object: `{cbrTitle, cbrDates, cbrSubreports, cbrTotals}`
- The `hledger.ts` wrapper needs typed parsing functions, not just generic `hledgerJson()`

### 2. Amount extraction is non-trivial
Each amount is a nested object:
```json
{
  "acommodity": "$",
  "aquantity": { "decimalMantissa": 5400, "decimalPlaces": 0, "floatingPoint": 5400 }
}
```
Extraction path: `amount.aquantity.floatingPoint`

### 3. Empty amount arrays in multi-period reports
When an account has no activity in a period, `prrAmounts[i]` is `[]` (empty array), not zero.
Parser MUST handle this or will crash with `undefined` errors.

### 4. `structuredContent` sizing for `financial-summary`
Raw `is -M` output is ~120KB. Must use `_meta` for large data and keep `structuredContent` trimmed.

---

## Important Improvements

### 5. Loading states (missing from plan)
Handle `isPending` from `useToolInfo`. Show skeleton/loading UI.

### 6. `data-llm` should be core, not stretch goal
Trivial to implement, critical for Claude to understand what widget is showing.

### 7. `content` field for narration
Return `content` alongside `structuredContent` so Claude can narrate results.

### 8. Add `annotations` to tool registrations
All widgets are read-only: `{ readOnlyHint: true, openWorldHint: false, destructiveHint: false }`

### 9. `execSync` needs try/catch
hledger exits code 1 on invalid input. Wrapper must catch and return user-friendly errors.

---

## Minor Notes

- Chart.js v4+ uses ResizeObserver (no iframe issues), but test `responsive: false` as fallback
- No `overflow: scroll/auto` in inline mode — use `useLayout()` for `maxHeight`
- Multi-commodity: consider `cur:$` filter or document as limitation
- Revenue signs are pre-flipped in `is` output (don't negate again)
- `hledger.ts` will be ~60-80 lines, not ~20

---

## Verified Facts

- hledger v1.51.2 installed at `/opt/homebrew/bin/hledger`
- Performance: ~60-70ms per command on 339 transactions (5000ms timeout has 80x margin)
- Minimum hledger version needed: 1.24+ (for `floatingPoint` field)

---

## Implementation Order

1. `data/sample.journal` — sample data (enables all testing)
2. `server/src/hledger.ts` — typed wrapper with parsers for both JSON shapes
3. `spending-breakdown` widget — simplest (single `bal` command)
4. `financial-trends` widget — medium (multi-period `is` with empty-array handling)
5. `financial-summary` widget — most complex (3 commands, metric cards, `_meta` splitting)
6. Polish: loading states, `data-llm`, `content` narration, styles
