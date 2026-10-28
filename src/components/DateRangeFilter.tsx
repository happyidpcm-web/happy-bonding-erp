import { useState } from "react";
import { Calendar } from "lucide-react";
import { useDismissibleDropdown } from "../hooks/useDismissibleDropdown";
import { CustomDateRangePopover, customRangeLabel, REPORT_DATE_OPTIONS } from "../App";
import type { CustomDateRange } from "../utils/invoiceDateRange";

export function DateRangeFilter({ value, range, onChange, onRangeChange }: {
  value: string; range: CustomDateRange;
  onChange: (value: string) => void;
  onRangeChange: (range: CustomDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const ref = useDismissibleDropdown(open || customOpen, () => { setOpen(false); setCustomOpen(false); });
  return <div className="sales-date-picker-wrap" ref={ref}>
    <button type="button" className="sales-date-range-btn" aria-label="Date filter" aria-expanded={open || customOpen}
      onClick={() => { setOpen(!open); setCustomOpen(false); }}>
      <Calendar size={15} color="#64748b" />
      <span>{value === "Custom Range" ? customRangeLabel(range) : value}</span>
      <Calendar size={15} color="#64748b" />
    </button>
    {open && <div className="sales-date-popover-menu">
      {REPORT_DATE_OPTIONS.map(option => <button key={option.label} type="button"
        className={"sales-date-option-row" + (value === option.label ? " selected" : "")}
        onClick={() => {
          setOpen(false);
          if (option.label === "Custom Range") setCustomOpen(true);
          else onChange(option.label);
        }}><span>{option.label}</span></button>)}
    </div>}
    {customOpen && <CustomDateRangePopover range={range} onCancel={() => setCustomOpen(false)} onApply={next => {
      onRangeChange(next); onChange("Custom Range"); setCustomOpen(false);
    }} />}
  </div>;
}
