import { useState } from "react";
import { CustomDateRangePopover, customRangeLabel, REPORT_DATE_OPTIONS } from "../App";
import type { CustomDateRange } from "../utils/invoiceDateRange";

export function DateRangeFilter({ value, range, onChange, onRangeChange }: {
  value: string; range: CustomDateRange;
  onChange: (value: string) => void;
  onRangeChange: (range: CustomDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontFamily: '"DM Sans", sans-serif', fontSize: 13, fontWeight: 500, color: "#334155" }}>
    <select aria-label="Date filter" value={value} onChange={e => {
      if (e.target.value === "Custom Range") setOpen(true);
      else { onChange(e.target.value); setOpen(false); }
    }} style={{ height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontFamily: '"DM Sans", sans-serif', fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: "#334155", cursor: "pointer" }}>
      {REPORT_DATE_OPTIONS.map(option => <option key={option.label} value={option.label} style={{ fontFamily: '"DM Sans", sans-serif', fontSize: 13, fontWeight: 400 }}>{option.label}</option>)}
    </select>
    {value === "Custom Range" && <button type="button" className="secondary" style={{ minHeight: 38, fontFamily: '"DM Sans", sans-serif', fontSize: 13, fontWeight: 500, color: "#334155" }} onClick={() => setOpen(true)}>{customRangeLabel(range)}</button>}
    {open && <CustomDateRangePopover range={range} onCancel={() => setOpen(false)} onApply={next => {
      onRangeChange(next); onChange("Custom Range"); setOpen(false);
    }} />}
  </div>;
}
