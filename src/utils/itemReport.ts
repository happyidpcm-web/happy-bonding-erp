type Row = Record<string, string | number>;
export type ItemReportSort = 'quantity-desc' | 'quantity-asc' | 'amount-desc' | 'amount-asc';

export function prepareItemReport(source: Row[], search: string, groupItems: boolean, sort: ItemReportSort) {
  const query = search.trim().toLowerCase();
  let rows = source;
  if (groupItems) {
    const groups = new Map<string, Row>();
    for (const row of rows) {
      const key = String(row['Product ID'] || row.Item);
      const target = groups.get(key) || { Item: row['Product Name'] || row.Item, Quantity: 0, Taxable: 0, CGST: 0, SGST: 0, IGST: 0, Amount: 0 };
      for (const column of ['Quantity', 'Taxable', 'CGST', 'SGST', 'IGST', 'Amount']) target[column] = Number(target[column]) + Number(row[column] || 0);
      groups.set(key, target);
    }
    const matchingKeys = new Set(source.filter(row => [row.Item, row['Product Name'], row['Item Code']].some(value => String(value || '').toLowerCase().includes(query))).map(row => String(row['Product ID'] || row.Item)));
    rows = [...groups.entries()].filter(([key]) => matchingKeys.has(key)).map(([, row]) => row);
  } else {
    rows = source.filter(row => Object.entries(row).some(([key, value]) => !key.startsWith('Product ') && String(value).toLowerCase().includes(query)));
  }
  const column = sort.startsWith('quantity') ? 'Quantity' : 'Amount';
  const direction = sort.endsWith('desc') ? -1 : 1;
  return [...rows].sort((a, b) => direction * (Number(a[column]) - Number(b[column])) || String(a.Item).localeCompare(String(b.Item)));
}
