import { useEffect, useId, useState } from "react";
import { useDismissibleDropdown } from "../hooks/useDismissibleDropdown";

type Option = { value: string; label: string };
export function SearchablePicker({ value, onChange, options, placeholder, emptyValue = "", emptyLabel = "Clear selection" }: {
  value: string; onChange: (value: string) => void; options: Option[];
  placeholder: string; emptyValue?: string; emptyLabel?: string;
}) {
  const selectedLabel = options.find(option => option.value === value)?.label || "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const ref = useDismissibleDropdown(open, () => { setOpen(false); setQuery(selectedLabel); });
  useEffect(() => { setQuery(selectedLabel); }, [selectedLabel]);
  const matches = options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 100);
  const choose = (option: Option) => { onChange(option.value); setQuery(option.label); setOpen(false); setActive(-1); };
  return <div ref={ref} style={{ position: "relative", minWidth: 200, maxWidth: "100%" }}>
    <input role="combobox" aria-label={placeholder} aria-expanded={open} aria-controls={id} aria-autocomplete="list"
      aria-activedescendant={open && active >= 0 ? id + "-" + active : undefined}
      value={query} placeholder={placeholder} autoComplete="off"
      style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#334155", fontSize: 13 }}
      onFocus={e => e.currentTarget.select()}
      onBlur={e => { if (!ref.current?.contains(e.relatedTarget)) { setOpen(false); setQuery(selectedLabel); } }}
      onChange={e => { setQuery(e.target.value); setOpen(Boolean(e.target.value.trim())); setActive(-1); if (!e.target.value) onChange(emptyValue); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, matches.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        if (e.key === "Enter" && open && matches[active >= 0 ? active : 0]) { e.preventDefault(); choose(matches[active >= 0 ? active : 0]); }
        if (e.key === "Escape") { setOpen(false); setQuery(selectedLabel); }
      }} />
    {value !== emptyValue && <button type="button" aria-label={emptyLabel} onClick={() => { onChange(emptyValue); setQuery(""); setOpen(false); }} style={{ border: 0, background: "transparent", color: "#64748b", fontSize: 12 }}>{emptyLabel}</button>}
    {open && <div id={id} role="listbox" style={{ position: "absolute", top: "100%", left: 0, width: "100%", minWidth: 240, maxHeight: 280, overflowY: "auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 10px 24px #0f172a22", zIndex: 1000 }}>
      {matches.map((option, index) => <button key={option.value} id={id + "-" + index} type="button" role="option" aria-selected={value === option.value}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(option)}
        style={{ display: "block", width: "100%", border: 0, padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#334155", background: active === index ? "#eef2ff" : "#fff" }}>{option.label}</button>)}
      {!matches.length && <div role="status" style={{ padding: 12, color: "#64748b", fontSize: 13 }}>No matches found</div>}
    </div>}
  </div>;
}
