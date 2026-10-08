function parseInvoiceDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const parts = dateStr.trim().split(/[\s\-\/]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase().slice(0, 3);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && months[monthStr] !== undefined && !isNaN(year)) {
      return new Date(year, months[monthStr], day);
    }
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  const d = new Date(dateStr);
  return d;
}

export type CustomDateRange = { from: string; to: string };

export function isInvoiceInDateRange(r: { date: string; dateISO?: string }, filter: string, customRange?: CustomDateRange, now = new Date()): boolean {
  const d = parseInvoiceDate(r.dateISO || r.date);
  if (isNaN(d.getTime())) return false;

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  if (filter === "Today") {
    return isSameDay(d, now);
  }
  if (filter === "Yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    return isSameDay(d, yest);
  }
  if (filter === "This Week") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - start.getDay()); // Sunday
    const end = startOfDay(new Date(start));
    end.setDate(end.getDate() + 6); // Saturday
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Last Week") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - start.getDay() - 7);
    const end = startOfDay(new Date(start));
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Last 7 Days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);
    return d >= start && d <= endOfDay(now);
  }
  if (filter === "This Month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (filter === "Previous Month") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  }
  if (filter === "Last 30 Days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);
    return d >= start && d <= endOfDay(now);
  }
  if (filter === "This Quarter") {
    const currentQ = Math.floor(now.getMonth() / 3);
    const q = Math.floor(d.getMonth() / 3);
    return q === currentQ && d.getFullYear() === now.getFullYear();
  }
  if (filter === "Previous Quarter") {
    const currentQ = Math.floor(now.getMonth() / 3);
    const prevQ = currentQ === 0 ? 3 : currentQ - 1;
    const year = currentQ === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const q = Math.floor(d.getMonth() / 3);
    return q === prevQ && d.getFullYear() === year;
  }
  if (filter === "Current Fiscal Year") {
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const start = new Date(year, 3, 1);
    const end = new Date(year + 1, 2, 31, 23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Previous Fiscal Year") {
    const year = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
    const start = new Date(year, 3, 1);
    const end = new Date(year + 1, 2, 31, 23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (filter === "Last 365 Days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 364);
    return d >= start && d <= endOfDay(now);
  }
  if (filter === "Custom Range") {
    if (!customRange?.from || !customRange?.to) return true;
    const start = parseInvoiceDate(customRange.from);
    const end = parseInvoiceDate(customRange.to);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  return true;
}

