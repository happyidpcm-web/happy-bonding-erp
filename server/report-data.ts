import { z } from 'zod';

export const reportQuery = z.object({
  filter: z.enum(['All', 'Today', 'Yesterday', 'This Week', 'Last Week', 'Last 7 Days', 'This Month', 'Previous Month', 'Last 30 Days', 'This Quarter', 'Previous Quarter', 'Current Fiscal Year', 'Previous Fiscal Year', 'Last 365 Days', 'Custom Range']).default('All'),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  fromTime: z.iso.time({ precision: -1 }).optional(), toTime: z.iso.time({ precision: -1 }).optional(),
}).superRefine((q, ctx) => {
  if (q.filter === 'Custom Range' && (!q.from || !q.to || `${q.from}T${q.fromTime || '00:00'}` > `${q.to}T${q.toTime || '23:59'}`)) {
    ctx.addIssue({ code: 'custom', message: 'Choose a valid start and end date.' });
  }
});
export type ReportQuery = z.infer<typeof reportQuery>;

// Invoice dates are stored as calendar dates at UTC midnight; today is the store's IST date.
export function reportBounds(q: ReportQuery, now = new Date()) {
  const today = new Date(`${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}T00:00:00Z`);
  let from = new Date(today), to = new Date(today);
  const day = (d: Date, n: number) => d.setUTCDate(d.getUTCDate() + n);
  const month = (offset: number, length: number) => {
    from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
    to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + length, 0));
  };
  switch (q.filter) {
    case 'Yesterday': day(from, -1); day(to, -1); break;
    case 'This Week': day(from, -today.getUTCDay()); to = new Date(from); day(to, 6); break;
    case 'Last Week': day(from, -today.getUTCDay() - 7); to = new Date(from); day(to, 6); break;
    case 'Last 7 Days': day(from, -6); break;
    case 'Last 30 Days': day(from, -29); break;
    case 'Last 365 Days': day(from, -364); break;
    case 'This Month': month(0, 1); break;
    case 'Previous Month': month(-1, 1); break;
    case 'This Quarter': month(-(today.getUTCMonth() % 3), 3); break;
    case 'Previous Quarter': month(-(today.getUTCMonth() % 3) - 3, 3); break;
    case 'Current Fiscal Year': case 'Previous Fiscal Year': {
      const year = today.getUTCFullYear() - (today.getUTCMonth() < 3 ? 1 : 0) - (q.filter === 'Previous Fiscal Year' ? 1 : 0);
      from = new Date(Date.UTC(year, 3, 1)); to = new Date(Date.UTC(year + 1, 2, 31)); break;
    }
    case 'Custom Range': from = new Date(`${q.from}T00:00:00Z`); to = new Date(`${q.to}T00:00:00Z`); break;
  }
  const end = new Date(to); day(end, 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), where: { gte: q.filter === 'All' ? undefined : from, lt: q.filter === 'All' ? undefined : end }, timestampWhere: { gte: q.filter === 'All' ? undefined : new Date(from.getTime() - 19800000), lt: q.filter === 'All' ? undefined : new Date(end.getTime() - 19800000) } };
}

export function storeCalendarDate(timestamp: Date) {
  return new Date(`${timestamp.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}T00:00:00Z`);
}

export function matchesReportTime(date: Date, recordedAt: Date, q: ReportQuery) {
  if (q.filter !== 'Custom Range' || (!q.fromTime && !q.toTime)) return true;
  const time = recordedAt.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const stamp = `${date.toISOString().slice(0, 10)}T${time}`;
  return stamp >= `${q.from}T${q.fromTime || '00:00'}` && stamp <= `${q.to}T${q.toTime || '23:59'}`;
}

export type ItemReportRow = { id: string; name: string; sku: string; category: string; size: string; salesQty: number; purchaseQty: number; salesAmount: number; purchaseAmount: number };
export function summarizeItems(catalog: Array<{ id: string; name: string; sku: string; category: string; size: string }>, sales: Array<{ variantId: string; itemName: string; sku: string; quantity: number; total: number }>, purchases: Array<{ variantId?: string; name: string; qty: number; amount: number }>) {
  const rows = new Map<string, ItemReportRow>(catalog.map(p => [p.id, { ...p, salesQty: 0, purchaseQty: 0, salesAmount: 0, purchaseAmount: 0 }]));
  const get = (id: string, name: string, sku = '') => {
    if (!rows.has(id)) rows.set(id, { id, name, sku, category: 'Uncategorized', size: '', salesQty: 0, purchaseQty: 0, salesAmount: 0, purchaseAmount: 0 });
    return rows.get(id)!;
  };
  for (const line of sales) { const r = get(line.variantId, line.itemName, line.sku); r.salesQty += line.quantity; r.salesAmount += line.total; }
  for (const line of purchases) { const r = get(line.variantId || `legacy:${line.name}`, line.name); r.purchaseQty += line.qty; r.purchaseAmount += line.amount; }
  return [...rows.values()].filter(r => r.salesQty || r.purchaseQty).map(r => ({ ...r, salesQty: Number(r.salesQty.toFixed(3)), purchaseQty: Number(r.purchaseQty.toFixed(3)), salesAmount: Number(r.salesAmount.toFixed(2)), purchaseAmount: Number(r.purchaseAmount.toFixed(2)) })).sort((a, b) => b.salesQty - a.salesQty || a.name.localeCompare(b.name));
}
