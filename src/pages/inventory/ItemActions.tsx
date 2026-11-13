import React, { useEffect, useState } from "react";
import { MoreVertical, Pencil, Boxes, Trash2 } from "lucide-react";
import { useDismissibleDropdown } from "../../hooks/useDismissibleDropdown";

export function ItemActions({ name, onEdit, onAdjust, onDelete }: { name: string; onEdit: () => void; onAdjust: () => void; onDelete: () => void }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const ref = useDismissibleDropdown(!!position, () => setPosition(null));
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [position]);
  const run = (action: () => void) => { setPosition(null); action(); };
  return <div ref={ref} className="item-actions-menu">
    <button className="icon-button" aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={!!position} onClick={e => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPosition(position ? null : { top: rect.bottom + 160 > window.innerHeight ? Math.max(8, rect.top - 150) : rect.bottom + 4, left: Math.max(8, rect.right - 180) });
    }}><MoreVertical size={20} /></button>
    {position && <div role="menu" aria-label={`Actions for ${name}`} className="item-row-menu" style={position}>
      <button role="menuitem" onClick={() => run(onEdit)}><Pencil size={16} />Edit</button>
      <button role="menuitem" onClick={() => run(onAdjust)}><Boxes size={16} />Adjust Stock</button>
      <button role="menuitem" className="stock-decrease" onClick={() => run(onDelete)}><Trash2 size={16} />Delete</button>
    </div>}
  </div>;
}
