import { useEffect, useState } from 'react';
import './backend-report.css';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { money } from '../../data';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import type { CustomDateRange } from '../../utils/invoiceDateRange';
import { EmailExcelReportModal } from './Reports';

export function ItemSummary({ onBack, notify }: { onBack: () => void; notify: (message: string) => void }) {
  const [sort, setSort] = useState('salesQty');
  const [category, setCategory] = useState('All Categories');
  const [filter, setFilter] = useState('Today');
  const [range, setRange] = useState<CustomDateRange>({ from: '', to: '' });
  const [data, setData] = useState<Awaited<ReturnType<typeof api.itemSummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const branchId = api.currentBranchId();
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    api.itemSummary(filter, range).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load report'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, range, branchId, retry]);
  const categories = [...new Set((data?.rows || []).map(r => r.category))].sort();
  const rows = (data?.rows || []).filter(r => (category === 'All Categories' || r.category === category) &&
    `${r.name} ${r.sku} ${r.size}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(b[sort as 'salesQty' | 'purchaseQty' | 'salesAmount' | 'purchaseAmount']) - Number(a[sort as 'salesQty' | 'purchaseQty' | 'salesAmount' | 'purchaseAmount']) || a.name.localeCompare(b.name));
  const totals = rows.reduce((s, r) => ({ salesQty: s.salesQty + r.salesQty, purchaseQty: s.purchaseQty + r.purchaseQty, salesAmount: s.salesAmount + r.salesAmount, purchaseAmount: s.purchaseAmount + r.purchaseAmount }), { salesQty: 0, purchaseQty: 0, salesAmount: 0, purchaseAmount: 0 });
  const excelRows = rows.map(r => ({ 'Item Name': r.name, 'Item Code': r.sku, Category: r.category, 'Sales Quantity': r.salesQty, 'Purchase Quantity': r.purchaseQty, 'Current Stock': r.currentStock, 'Sales Amount': r.salesAmount, 'Purchase Amount': r.purchaseAmount }));
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelRows), 'Item Sales Purchase');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ From: data?.from, To: data?.to, Category: category, Search: search, ...totals }]), 'Filters and Totals');
    XLSX.writeFile(wb, `item_sales_purchase_${data?.from}_${data?.to}.xlsx`);
  };
  const qty = (n: number) => Number(n.toFixed(3));
  return <div className="report-screen-wrap printable-report item-sales-report">
    <div className="page-heading">
      <div><button type="button" className="secondary" onClick={onBack}>Back</button><h1>Item Sales and Purchase Summary</h1></div>
      <div className="header-actions">
        <button className="secondary" disabled={loading || !!error || !rows.length} onClick={exportExcel}>Download Excel</button>
        <button className="secondary" disabled={loading || !!error || !rows.length} onClick={() => setEmailOpen(true)}>Email Excel</button>
        <button className="secondary" disabled={loading || !!error} onClick={() => window.print()}>Print PDF</button>
      </div>
    </div>
    <div className="backend-report-filters">
      <DateRangeFilter value={filter} range={range} onChange={setFilter} onRangeChange={setRange} />
      <select aria-label="Report category" value={category} onChange={e => setCategory(e.target.value)}><option>All Categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
      <input aria-label="Search report items" placeholder="Search item / code" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Sort summary" value={sort} onChange={e => setSort(e.target.value)}><option value="salesQty">Sales quantity: Highest first</option><option value="purchaseQty">Purchase quantity: Highest first</option><option value="salesAmount">Sales amount: Highest first</option><option value="purchaseAmount">Purchase amount: Highest first</option></select>
      <button className="secondary" disabled={loading} onClick={() => setRetry(n => n + 1)}>Refresh</button>
    </div>
    {data && <div className="item-report-period"><div><span className="item-report-caption">Report period</span><strong>{new Date(data.from + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}{data.from !== data.to && <> ? {new Date(data.to + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}</>}</strong></div><span className="item-report-count">{rows.length} items</span></div>}
    <p style={{ fontSize: 12, color: 'var(--muted)' }}>Purchases and sales follow the selected period. Current stock is the live balance including opening stock and adjustments. Returns are excluded from purchase/sales totals. Older stock receipts use their recorded receipt date.</p>
    {loading ? <p role="status">Loading sales and purchases…</p> : error ? <div role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry</button></div> : <>
      <div className="item-report-totals">
        <div><span>Sales quantity</span><strong>{qty(totals.salesQty)}</strong></div><div><span>Purchase quantity</span><strong>{qty(totals.purchaseQty)}</strong></div>
        <div><span>Sales amount</span><strong>{money(totals.salesAmount)}</strong></div><div><span>Purchase amount</span><strong>{money(totals.purchaseAmount)}</strong></div>
      </div>
      <article className="card table-card"><div className="table-scroll"><table>
        <thead><tr><th>Item Name</th><th>Item Code</th><th>Category</th><th className="right">Sales Quantity</th><th className="right">Purchase Quantity</th><th className="right">Current Stock</th><th className="right">Sales Amount</th><th className="right">Purchase Amount</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.sku || '—'}</td><td>{r.category}</td><td className="right">{r.salesQty}</td><td className="right">{r.purchaseQty}</td><td className="right">{r.currentStock ?? 0}</td><td className="right">{money(r.salesAmount)}</td><td className="right">{money(r.purchaseAmount)}</td></tr>)}
          {!rows.length && <tr><td colSpan={8}>No sales or purchases match this date range and filters.</td></tr>}</tbody>
        <tfoot><tr><th colSpan={3}>Total</th><th className="right">{qty(totals.salesQty)}</th><th className="right">{qty(totals.purchaseQty)}</th><th className="right">{qty(rows.reduce((sum, r) => sum + (r.currentStock ?? 0), 0))}</th><th className="right">{money(totals.salesAmount)}</th><th className="right">{money(totals.purchaseAmount)}</th></tr></tfoot>
      </table></div></article>
    </>}
    {emailOpen && <EmailExcelReportModal reportName={`Item Summary ${data?.from} to ${data?.to}`} reportRows={excelRows} onClose={() => setEmailOpen(false)} notify={notify} />}
  </div>;
}
