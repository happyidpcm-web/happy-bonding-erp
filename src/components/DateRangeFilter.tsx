import { useState } from "react";
import { CustomDateRangePopover, customRangeLabel, REPORT_DATE_OPTIONS } from "../App";
import type { CustomDateRange } from "../utils/invoiceDateRange";

export function DateRangeFilter({ value, range, onChange, onRangeChange }: {
  value: string; range: CustomDateRange;
  onChange: (value: string) => void;
  onRangeChange: (range: CustomDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "center" }}>
    <select aria-label="Date filter" value={value} onChange={e => {
      if (e.target.value === "Custom Range") setOpen(true);
      else { onChange(e.target.value); setOpen(false); }
    }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}>
      {REPORT_DATE_OPTIONS.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
    </select>
    {value === "Custom Range" && <button type="button" className="secondary" onClick={() => setOpen(true)}>{customRangeLabel(range)}</button>}
    {open && <CustomDateRangePopover range={range} onCancel={() => setOpen(false)} onApply={next => {
      onRangeChange(next); onChange("Custom Range"); setOpen(false);
    }} />}
  </div>;
}
