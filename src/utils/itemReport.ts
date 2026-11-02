type Row = Record<string, string | number>;
export type ItemReportSort = 'quantity-desc' | 'quantity-asc' | 'amount-desc' | 'amount-asc';

export function prepareItemReport(source: Row[], search: string, groupItems: boolean, sort: ItemReportSort) {
  let rows = source.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(search.trim().toLowerCase())));
  if (groupItems) {
    const groups = new Map<string, Row>();
    for (const row of rows) {
      const key = JSON.stringify([row['Item Code'], row.Size, row.Item]);
      const target = groups.get(key) || { Item: row.Item, 'Item Code': row['Item Code'], Size: row.Size, Quantity: 0, Taxable: 0, CGST: 0, SGST: 0, IGST: 0, Amount: 0 };
      for (const column of ['Quantity', 'Taxable', 'CGST', 'SGST', 'IGST', 'Amount']) target[column] = Number(target[column]) + Number(row[column] || 0);
      groups.set(key, target);
    }
    rows = [...groups.values()];
  }
  const column = sort.startsWith('quantity') ? 'Quantity' : 'Amount';
  const direction = sort.endsWith('desc') ? -1 : 1;
  return [...rows].sort((a, b) => direction * (Number(a[column]) - Number(b[column])) || String(a.Item).localeCompare(String(b.Item)));
}
