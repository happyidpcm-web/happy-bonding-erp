import { useEffect, useState } from "react";

export function DiscountInput({ value, max, label, onChange }: {
  value: number; max: number; label: string; onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value || ""));
  useEffect(() => { setDraft(String(value || "")); }, [value]);
  const digits = String(Math.floor(Math.max(0, max))).length;
  return <input type="text" inputMode="decimal" aria-label={label} placeholder="0"
    value={draft} maxLength={digits + 3}
    onFocus={e => e.currentTarget.select()}
    onChange={e => {
      const next = e.target.value;
      if (!/^\d*(\.\d{0,2})?$/.test(next) || next.split(".")[0].length > digits) return;
      const amount = Number(next || 0);
      if (!Number.isFinite(amount) || amount > max) return;
      setDraft(next);
      onChange(amount);
    }}
    onBlur={() => setDraft(String(value || ""))} />;
}
