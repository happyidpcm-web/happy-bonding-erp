import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { money } from '../../data';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import type { CustomDateRange } from '../../utils/invoiceDateRange';
import { EmailExcelReportModal } from './Reports';

export function ItemSummary({ onBack, notify }: { onBack: () => void; notify: (message: string) => void }) {
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
    `${r.name} ${r.sku} ${r.size}`.toLowerCase().includes(search.toLowerCase()));
  const totals = rows.reduce((s, r) => ({ salesQty: s.salesQty + r.salesQty, purchaseQty: s.purchaseQty + r.purchaseQty, salesAmount: s.salesAmount + r.salesAmount, purchaseAmount: s.purchaseAmount + r.purchaseAmount }), { salesQty: 0, purchaseQty: 0, salesAmount: 0, purchaseAmount: 0 });
  const excelRows = rows.map(r => ({ 'Item Name': r.name, 'Item Code': r.sku, Size: r.size, Category: r.category, 'Sales Quantity': r.salesQty, 'Purchase Quantity': r.purchaseQty, 'Sales Amount': r.salesAmount, 'Purchase Amount': r.purchaseAmount }));
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelRows), 'Item Sales Purchase');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ From: data?.from, To: data?.to, Category: category, Search: search, ...totals }]), 'Filters and Totals');
    XLSX.writeFile(wb, `item_sales_purchase_${data?.from}_${data?.to}.xlsx`);
  };
  const qty = (n: number) => Number(n.toFixed(3));
  return <div className="report-screen-wrap printable-report">
    <div className="page-heading">
      <div><button type="button" className="secondary" onClick={onBack}>Back</button><h1>Item Sales and Purchase Summary</h1></div>
      <div className="header-actions">
        <button className="secondary" disabled={loading || !!error || !rows.length} onClick={exportExcel}>Download Excel</button>
        <button className="secondary" disabled={loading || !!error || !rows.length} onClick={() => setEmailOpen(true)}>Email Excel</button>
        <button className="secondary" disabled={loading || !!error} onClick={() => window.print()}>Print PDF</button>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <DateRangeFilter value={filter} range={range} onChange={setFilter} onRangeChange={setRange} />
      <select aria-label="Report category" value={category} onChange={e => setCategory(e.target.value)}><option>All Categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
      <input aria-label="Search report items" placeholder="Search item / code / size" value={search} onChange={e => setSearch(e.target.value)} />
      <button className="secondary" disabled={loading} onClick={() => setRetry(n => n + 1)}>Refresh</button>
    </div>
    <p>{data ? `${data.from} to ${data.to} · ` : ''}Weeks run Sunday–Saturday. Gross invoiced quantities, before returns. Amounts include line tax and discounts; bill-level adjustments are excluded.</p>
    {loading ? <p role="status">Loading sales and purchases…</p> : error ? <div role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry</button></div> : <>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>Sales quantity: <strong>{qty(totals.salesQty)}</strong></div><div>Purchase quantity: <strong>{qty(totals.purchaseQty)}</strong></div>
        <div>Sales amount: <strong>{money(totals.salesAmount)}</strong></div><div>Purchase amount: <strong>{money(totals.purchaseAmount)}</strong></div>
      </div>
      <article className="card table-card"><div className="table-scroll"><table>
        <thead><tr><th>Item Name</th><th>Item Code</th><th>Size</th><th>Category</th><th className="right">Sales Quantity</th><th className="right">Purchase Quantity</th><th className="right">Sales Amount</th><th className="right">Purchase Amount</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.sku || '—'}</td><td>{r.size || '—'}</td><td>{r.category}</td><td className="right">{r.salesQty}</td><td className="right">{r.purchaseQty}</td><td className="right">{money(r.salesAmount)}</td><td className="right">{money(r.purchaseAmount)}</td></tr>)}
          {!rows.length && <tr><td colSpan={8}>No sales or purchases match this date range and filters.</td></tr>}</tbody>
        <tfoot><tr><th colSpan={4}>Total</th><th className="right">{qty(totals.salesQty)}</th><th className="right">{qty(totals.purchaseQty)}</th><th className="right">{money(totals.salesAmount)}</th><th className="right">{money(totals.purchaseAmount)}</th></tr></tfoot>
      </table></div></article>
    </>}
    {emailOpen && <EmailExcelReportModal reportName={`Item Summary ${data?.from} to ${data?.to}`} reportRows={excelRows} onClose={() => setEmailOpen(false)} notify={notify} />}
  </div>;
}
