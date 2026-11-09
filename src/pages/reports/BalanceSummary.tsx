import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../api';
import { money } from '../../data';
import './backend-report.css';

export function BalanceSummary({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.balanceSummary>> | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const branchId = api.currentBranchId();
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    api.balanceSummary().then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message || 'Unable to load balances'); });
    return () => { active = false; };
  }, [branchId, refresh]);
  const rows = data ? [
    { Item: 'Stock value estimate', Amount: data.stockValue, Basis: 'Current quantities multiplied by current purchase prices; not historical inventory valuation.' },
    { Item: 'Sales invoice dues', Amount: data.invoiceDue, Basis: 'Posted invoice totals less current paid amounts and linked credit notes. Includes unpaid cash-sale invoices.' },
    { Item: 'Invoice credit excess', Amount: data.invoiceCredit, Basis: 'Payments and linked credit notes exceeding invoice totals; review for refunds or customer credits.' },
    { Item: 'Party opening receivables', Amount: data.openingReceivable, Basis: 'Original opening amounts to collect, not remaining dues. Shown separately from invoices.' },
    { Item: 'Party opening payables', Amount: data.openingPayable, Basis: 'Original opening amounts to pay, not remaining dues. Shown separately from purchases.' },
    { Item: 'Recorded purchase invoice dues', Amount: data.purchaseDue, Basis: 'Purchase totals less paid amounts saved on those invoices. Separate Payment Out, returns and debit notes are not reconciled.' },
    { Item: 'Recorded money received', Amount: data.received, Basis: 'All saved incoming payment records across payment modes.' },
    { Item: 'Recorded money paid', Amount: data.paid, Basis: 'All saved outgoing payment records across payment modes.' },
    { Item: 'Net recorded payment movement', Amount: data.netMovement, Basis: 'Received minus paid. Not a cash or bank balance; opening balances and unrecorded transactions are excluded.' },
  ] : [];
  const note = 'Preliminary summary of current saved records for this branch, including any future-dated entries. Not a complete balance sheet. Fixed assets, loans, owner capital, retained earnings and reconciled cash/bank balances are not available. These rows are separate measures and must not be added together.';
  const warnings = data ? [data.negativeStockItems ? `${data.negativeStockItems} stock items have negative quantities and reduce the estimate.` : '', data.missingPurchasePayments ? `${data.missingPurchasePayments} purchase invoices have missing or invalid paid amounts and are excluded from purchase dues.` : ''].filter(Boolean) : [];
  const generatedAt = data ? new Date(data.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : '';
  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Preliminary balances');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Branch: branchId, Generated: generatedAt, Notes: note, Warnings: warnings.join(' ') }]), 'Report notes');
    XLSX.writeFile(workbook, 'preliminary-balance-summary.xlsx');
  }
  return <div className="printable-report item-sales-report">
    <div className="page-heading"><div className="back-heading"><button className="icon-button" onClick={onBack} aria-label="Back to reports"><ArrowLeft size={18} /></button><h1>Preliminary Balance Summary</h1></div>
      <div className="header-actions"><button className="secondary" onClick={() => setRefresh(n => n + 1)}>Refresh</button><button className="secondary" disabled={!data} onClick={exportExcel}>Download Excel</button><button className="secondary" disabled={!data} onClick={() => window.print()}>Print PDF</button></div>
    </div>
    <p>{note}</p>
    {error ? <p role="alert">{error} <button onClick={() => setRefresh(n => n + 1)}>Retry</button></p> : !data ? <p role="status">Loading current balances...</p> : <>
      <div className="item-report-period"><div><span className="item-report-caption">Current saved records</span><strong>Generated {generatedAt}</strong></div></div>
      {warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}
      <article className="card table-card"><div className="table-scroll"><table><thead><tr><th>Item</th><th className="item-report-number">Amount</th><th>What this includes</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.Item}><td>{row.Item}</td><td className="item-report-number">{money(row.Amount)}</td><td>{row.Basis}</td></tr>)}
      </tbody></table></div></article>
    </>}
  </div>;
}
