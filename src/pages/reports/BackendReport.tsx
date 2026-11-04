import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import './backend-report.css';
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
  const [filter, setFilter] = useState(initialDateSelection?.filter || 'All');
  const [range, setRange] = useState<CustomDateRange>(initialDateSelection?.range || { from: '', to: '' });
  const [data, setData] = useState<Awaited<ReturnType<typeof api.reportTable>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const isAgeingReport = report.kind === 'receivable-ageing';
  const isStockReport = report.kind === 'stock-detail';
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
  const columns = isItemReport && itemView === 'items' ? ['Item', 'Quantity', 'Amount'] : (data?.columns || []);
  const columnLabel = (column: string) => isItemReport && itemView === 'items' ? ({ Quantity: 'Total quantity sold', Amount: 'Total sales amount' }[column] || column) : isAgeingReport ? column.replace(/(\d)\?(\d)/g, '$1-$2') : column;
  const notDue = rows.reduce((sum, r) => sum + Number(r['Not Due'] || 0), 0);
  const overdue = rows.reduce((sum, r) => sum + (data?.moneyColumns || []).filter(c => c !== 'Not Due').reduce((n, c) => n + Number(r[c] || 0), 0), 0);
  const totalQuantity = Number(rows.reduce((sum, row) => sum + Number(row.Quantity || 0), 0).toFixed(3));
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.Amount || 0), 0);
  const exportRows = rows.map(r => Object.fromEntries(columns.map(c => {
    const value = r[c] ?? '';
    // Format calendar dates explicitly so Excel exports use day/month/year.
    const date = /(^|\s)date$/i.test(c) && typeof value === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
      : null;
    return [columnLabel(c), date ? `${date[3]}/${date[2]}/${date[1]}` : value];
  })));
  if (isItemReport || isAgeingReport) exportRows.push(Object.fromEntries(columns.map((c, index) => [columnLabel(c), index === 0 ? 'Total' : c === 'Quantity' ? totalQuantity : data?.moneyColumns.includes(c) ? Number(rows.reduce((sum, row) => sum + Number(row[c] || 0), 0).toFixed(2)) : ''])));
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows), 'Report');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Report: report.title, From: filter === 'All' ? 'All' : data?.from, To: filter === 'All' ? 'All' : data?.to, Search: search, ...(isItemReport ? { View: itemView, Sort: sort } : {}), Notes: data?.note }]), 'Filters');
    XLSX.writeFile(wb, `${report.kind}_${data?.from}_${data?.to}.xlsx`);
  };
  const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
  return <div className={isAgeingReport ? 'printable-report item-sales-report ageing-report' : isStockReport ? 'printable-report item-sales-report stock-detail-report' : isItemReport ? 'printable-report item-sales-report' : 'printable-report'}>
    <div className="page-heading"><div className="back-heading"><button type="button" className="icon-button" onClick={onBack} aria-label="Back" title="Back to Reports"><ArrowLeft size={18} /></button><h1>{isItemReport && itemView === 'items' ? 'Item Sales Totals' : report.title}</h1></div>
      <div className="header-actions"><button className="secondary" disabled={loading || !!error || !rows.length} onClick={exportExcel}>Download Excel</button><button className="secondary" disabled={loading || !!error || !rows.length} onClick={() => setEmailOpen(true)}>Email Excel</button><button className="secondary" disabled={loading || !!error} onClick={() => window.print()}>Print PDF</button></div>
    </div>
    <div className="backend-report-filters"><DateRangeFilter value={filter} range={range} onChange={setFilter} onRangeChange={setRange} /><input aria-label="Search report" placeholder="Search this report" value={search} onChange={e => setSearch(e.target.value)} /><button className="secondary" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Refresh</button></div>
    {isItemReport && <div className="backend-report-filters">
      <label>View <select aria-label="Item report view" value={itemView} onChange={e => setItemView(e.target.value)}><option value="items">Item totals (all sizes and parties)</option><option value="parties">Item by party</option></select></label>
      <label>Sort by <select aria-label="Sort items" value={sort} onChange={e => setSort(e.target.value as ItemReportSort)}><option value="quantity-desc">Quantity: Highest first</option><option value="quantity-asc">Quantity: Lowest first</option><option value="amount-desc">Amount: Highest first</option><option value="amount-asc">Amount: Lowest first</option></select></label>
    </div>}
    {loading ? <p role="status">Loading report…</p> : error ? <p role="alert">{error} <button onClick={() => setRefresh(n => n + 1)}>Retry</button></p> : data && <>
      {isAgeingReport ? <>
        <div className="item-report-period"><div><span className="item-report-caption">Outstanding as of</span><strong>{formatDate(data.to)}</strong></div><span className="item-report-count">{rows.length} unpaid invoices</span></div>
        <div className="item-report-totals ageing-totals">
          <div><span>Total outstanding</span><strong>{money(notDue + overdue)}</strong></div>
          <div><span>Not yet overdue</span><strong>{money(notDue)}</strong></div>
          <div><span>Overdue</span><strong>{money(overdue)}</strong></div>
        </div>
        <p className="ageing-note">Includes unpaid invoices up to the selected end date. Overdue days use each customer's current credit period. Opening balances are excluded. Totals follow your search.</p>
      </> : isItemReport || isStockReport ? <div className="item-report-period">
        <div><span className="item-report-caption">{isStockReport ? 'Stock movement period' : 'Sales period'}</span><strong>{filter === 'All' ? 'All' : <>{formatDate(data.from)}{data.from !== data.to && <> to {formatDate(data.to)}</>}</>}</strong></div>
        <span className="item-report-count">{rows.length.toLocaleString('en-IN')} {isStockReport ? 'movements' : itemView === 'items' ? 'items' : 'records'}</span>
      </div> : <><p>{filter === 'All' ? 'All' : `${data.from} to ${data.to}`} ? {rows.length} records ? Weeks run Sunday?Saturday.</p><p>{data.note}</p></>}
      {isStockReport && <>
        <div className="item-report-totals">{['Stock In', 'Stock Out'].map(c => <div key={c}><span>{c} (Pieces)</span><strong>{rows.reduce((sum, row) => sum + Number(row[c] || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</strong></div>)}</div>
        <p className="low-stock-explanation">{data.note} Unit cost is shown only when recorded.</p>
      </>}
      {isItemReport && <div className="item-report-totals">
        <div><span>Total pieces sold</span><strong>{totalQuantity.toLocaleString('en-IN')}</strong></div>
        <div><span>Total sales amount</span><strong>{money(totalAmount)}</strong></div>
      </div>}
      <article className="card table-card"><div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c} className={(isItemReport || isStockReport || isAgeingReport) && (c === 'Quantity' || c === 'Stock In' || c === 'Stock Out' || data.moneyColumns.includes(c)) ? 'item-report-number' : undefined}>{columnLabel(c)}</th>)}</tr></thead><tbody>
        {rows.map((r, index) => <tr key={index}>{columns.map(c => <td key={c} className={(isItemReport || isStockReport || isAgeingReport) && (c === 'Quantity' || c === 'Stock In' || c === 'Stock Out' || data.moneyColumns.includes(c)) ? 'item-report-number' : undefined}>{data.moneyColumns.includes(c) && typeof r[c] === 'number' ? money(r[c] as number) : isStockReport && c === 'Date' ? formatDate(String(r[c])) : isAgeingReport && (c === 'Invoice Date' || c === 'Due Date') ? formatDate(String(r[c])) : isAgeingReport && c === 'Party' && !r[c] ? 'Customer unavailable' : r[c]}</td>)}</tr>)}
        {!rows.length && <tr><td colSpan={columns.length}>No records match this date range and search.</td></tr>}
      </tbody><tfoot><tr>{columns.map((c, index) => <th key={c} className={(isItemReport || isStockReport || isAgeingReport) && (c === 'Quantity' || c === 'Stock In' || c === 'Stock Out' || data.moneyColumns.includes(c)) ? 'item-report-number' : undefined}>{index === 0 ? 'Total' : isStockReport ? (c === 'Stock In' || c === 'Stock Out' ? rows.reduce((sum, r) => sum + Number(r[c] || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '') : isItemReport && c === 'Quantity' ? totalQuantity : data.moneyColumns.includes(c) ? money(rows.reduce((s, r) => s + (typeof r[c] === 'number' ? r[c] as number : 0), 0)) : ''}</th>)}</tr></tfoot></table></div></article>
    </>}
    {emailOpen && <EmailExcelReportModal reportName={`${report.title} ${data?.from} to ${data?.to}`} reportRows={exportRows} onClose={() => setEmailOpen(false)} notify={notify} />}
  </div>;
}
