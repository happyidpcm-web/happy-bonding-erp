import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min"> & {
  value: number;
  min?: number;
  onValueChange: (value: number) => void;
};

// Keep the typed text while editing, so clearing and decimal entry do not
// immediately put a default number back into the field.
export function NumberInput({ value, min = 0, onValueChange, onFocus, onBlur, ...props }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(String(value)); }, [value, focused]);
  return <input {...props} type="number" min={min} value={draft}
    onFocus={event => { setFocused(true); event.currentTarget.select(); onFocus?.(event); }}
    onChange={event => {
      const text = event.target.value;
      setDraft(text);
      const number = Number(text);
      if (text !== "" && Number.isFinite(number) && number >= min) onValueChange(number);
    }}
    onBlur={event => {
      const number = draft.trim() === "" ? min : Number(draft);
      const next = Number.isFinite(number) ? Math.max(min, number) : min;
      setDraft(String(next)); setFocused(false); onValueChange(next); onBlur?.(event);
    }} />;
}
