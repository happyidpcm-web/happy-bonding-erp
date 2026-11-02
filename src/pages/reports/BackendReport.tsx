import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { money } from '../../data';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import type { CustomDateRange, DateRangeSelection } from '../../utils/invoiceDateRange';
import { EmailExcelReportModal } from './Reports';
import { prepareItemReport, type ItemReportSort } from '../../utils/itemReport';

export const backendReports: Record<string, { kind: string; title: string }> = {
  'Bill-wise profit': { kind: 'bill-profit', title: 'Bill Wise Profit' },
  'Sales summary': { kind: 'sales-summary', title: 'Sales Summary' },
  'Receivable ageing': { kind: 'receivable-ageing', title: 'Receivable Ageing Report' },
  'Purchase summary': { kind: 'purchase-summary', title: 'Purchase Summary' },
  'Expense transactions': { kind: 'expense-transactions', title: 'Expense Transaction Report' },
  'Expense categories': { kind: 'expense-category', title: 'Expense Category Report' },
  'Cash & bank report': { kind: 'cash-bank', title: 'Cash and Bank Report (All Payments)' },
  'Stock detail': { kind: 'stock-detail', title: 'Stock Detail Report' },
  'Item by party': { kind: 'item-party', title: 'Item Report By Party' },
  'Party by item': { kind: 'party-item', title: 'Party Report By Item' },
  'Category sales': { kind: 'category-sales', title: 'Sales Summary - Category Wise' },
  'HSN-wise summary': { kind: 'hsn-sales', title: 'HSN Wise Sales Summary' },
  'GST sales': { kind: 'gst-sales', title: 'GST Sales (With HSN)' },
  'GST purchases': { kind: 'gst-purchases', title: 'GST Purchase (With HSN)' },
  'Party outstanding': { kind: 'party-outstanding', title: 'Party Wise Outstanding' },
  'Party ledger': { kind: 'party-ledger', title: 'Party Statement (Ledger)' },
  'Audit trail': { kind: 'audit-trail', title: 'Audit Trail' },
  'Sales by staff': { kind: 'sales-staff', title: 'Sales Summary - Staff Wise' },
  'Daybook by staff': { kind: 'daybook-staff', title: 'Daybook - Staff Wise' },
  'Sales returns': { kind: 'sales-returns', title: 'Sales Returns' },
};

export function BackendReport({ report, onBack, notify, initialDateSelection }: { report: { kind: string; title: string }; onBack: () => void; notify: (message: string) => void; initialDateSelection?: DateRangeSelection }) {
  const [filter, setFilter] = useState(initialDateSelection?.filter || 'Today');
  const [range, setRange] = useState<CustomDateRange>(initialDateSelection?.range || { from: '', to: '' });
  const [data, setData] = useState<Awaited<ReturnType<typeof api.reportTable>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const isItemReport = report.kind === 'item-party';
  const [itemView, setItemView] = useState('items');
  const [sort, setSort] = useState<ItemReportSort>('quantity-desc');
  const branchId = api.currentBranchId();
  useEffect(() => {
    let active = true;
    setData(null); setLoading(true); setError('');
    api.reportTable(report.kind, filter, range).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load report'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [report.kind, filter, range, branchId, refresh]);
  const rows = isItemReport ? prepareItemReport(data?.rows || [], search, itemView === 'items', sort) : (data?.rows || []).filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const columns = (data?.columns || []).filter(c => !(isItemReport && itemView === 'items' && c === 'Party'));
  const totalQuantity = Number(rows.reduce((sum, row) => sum + Number(row.Quantity || 0), 0).toFixed(3));
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.Amount || 0), 0);
  const exportRows = rows.map(r => Object.fromEntries(columns.map(c => [c, r[c] ?? ''])));
  if (isItemReport) exportRows.push(Object.fromEntries(columns.map((c, index) => [c, index === 0 ? 'Total' : c === 'Quantity' ? totalQuantity : data?.moneyColumns.includes(c) ? Number(rows.reduce((sum, row) => sum + Number(row[c] || 0), 0).toFixed(2)) : ''])));
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows), 'Report');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Report: report.title, From: data?.from, To: data?.to, Search: search, ...(isItemReport ? { View: itemView, Sort: sort } : {}), Notes: data?.note }]), 'Filters');
    XLSX.writeFile(wb, `${report.kind}_${data?.from}_${data?.to}.xlsx`);
  };
  return <div className="printable-report">
    <div className="page-heading"><div><button className="secondary" onClick={onBack}>Back</button><h1>{report.title}</h1></div>
      <div className="header-actions"><button className="secondary" disabled={loading || !!error || !rows.length} onClick={exportExcel}>Download Excel</button><button className="secondary" disabled={loading || !!error || !rows.length} onClick={() => setEmailOpen(true)}>Email Excel</button><button className="secondary" disabled={loading || !!error} onClick={() => window.print()}>Print PDF</button></div>
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}><DateRangeFilter value={filter} range={range} onChange={setFilter} onRangeChange={setRange} /><input aria-label="Search report" placeholder="Search this report" value={search} onChange={e => setSearch(e.target.value)} /><button className="secondary" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Refresh</button></div>
    {isItemReport && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <label>View <select aria-label="Item report view" value={itemView} onChange={e => setItemView(e.target.value)}><option value="items">Item totals (all parties)</option><option value="parties">Item by party</option></select></label>
      <label>Sort by <select aria-label="Sort items" value={sort} onChange={e => setSort(e.target.value as ItemReportSort)}><option value="quantity-desc">Quantity: Highest first</option><option value="quantity-asc">Quantity: Lowest first</option><option value="amount-desc">Amount: Highest first</option><option value="amount-asc">Amount: Lowest first</option></select></label>
    </div>}
    {loading ? <p role="status">Loading report…</p> : error ? <p role="alert">{error} <button onClick={() => setRefresh(n => n + 1)}>Retry</button></p> : data && <>
      <p>{data.from} to {data.to} · {rows.length} records · Weeks run Sunday–Saturday.</p><p>{data.note}</p>
      {isItemReport && <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>Total pieces sold: <strong>{totalQuantity}</strong></div><div>Total sales amount: <strong>{money(totalAmount)}</strong></div>
        <span>Totals follow the selected date range and search.</span>
      </div>}
      <article className="card table-card"><div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>
        {rows.map((r, index) => <tr key={index}>{columns.map(c => <td key={c}>{data.moneyColumns.includes(c) && typeof r[c] === 'number' ? money(r[c] as number) : r[c]}</td>)}</tr>)}
        {!rows.length && <tr><td colSpan={columns.length}>No records match this date range and search.</td></tr>}
      </tbody><tfoot><tr>{columns.map((c, index) => <th key={c}>{index === 0 ? 'Total' : isItemReport && c === 'Quantity' ? totalQuantity : data.moneyColumns.includes(c) ? money(rows.reduce((s, r) => s + (typeof r[c] === 'number' ? r[c] as number : 0), 0)) : ''}</th>)}</tr></tfoot></table></div></article>
    </>}
    {emailOpen && <EmailExcelReportModal reportName={`${report.title} ${data?.from} to ${data?.to}`} reportRows={exportRows} onClose={() => setEmailOpen(false)} notify={notify} />}
  </div>;
}
