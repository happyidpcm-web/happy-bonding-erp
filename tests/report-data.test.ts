import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportBounds, reportQuery, matchesReportTime, summarizeItems } from '../server/report-data.ts';

test('report presets use IST today and Sunday to Saturday weeks', () => {
  const now = new Date('2026-11-01T19:00:00Z'); // Monday in the store.
  for (const [filter, from, to] of [
    ['Today', '2026-11-02', '2026-11-02'], ['Yesterday', '2026-11-01', '2026-11-01'],
    ['This Week', '2026-11-01', '2026-11-07'], ['Last Week', '2026-10-25', '2026-10-31'],
    ['Previous Month', '2026-10-01', '2026-10-31'], ['Last 7 Days', '2026-10-27', '2026-11-02'],
    ['This Quarter', '2026-10-01', '2026-12-31'], ['Previous Quarter', '2026-07-01', '2026-09-30'],
    ['Current Fiscal Year', '2026-04-01', '2027-03-31'], ['Previous Fiscal Year', '2025-04-01', '2026-03-31'],
  ]) {
    const actual = reportBounds(reportQuery.parse({ filter }), now);
    assert.equal(actual.from, from, filter); assert.equal(actual.to, to, filter);
    assert.equal(actual.where.lt!.getTime() - new Date(`${to}T00:00:00Z`).getTime(), 86400000);
  }
});

test('report ranges cross years and include leap day', () => {
  const previous = reportBounds(reportQuery.parse({ filter: 'Previous Month' }), new Date('2027-01-03T12:00:00Z'));
  assert.equal(previous.from, '2026-12-01'); assert.equal(previous.to, '2026-12-31');
  const leap = reportBounds(reportQuery.parse({ filter: 'This Month' }), new Date('2028-02-10T12:00:00Z'));
  assert.equal(leap.to, '2028-02-29');
});

test('custom ranges reject invalid dates, missing bounds and reversed times', () => {
  for (const q of [ { filter: 'Custom Range' }, { filter: 'Custom Range', from: '2026-02-30', to: '2026-03-02' },
    { filter: 'Custom Range', from: '2026-11-02', to: '2026-11-01' },
    { filter: 'Custom Range', from: '2026-11-02', to: '2026-11-02', fromTime: '14:00', toTime: '10:00' } ]) {
    assert.equal(reportQuery.safeParse(q).success, false);
  }
  const q = reportQuery.parse({ filter: 'Custom Range', from: '2026-11-02', to: '2026-11-02', fromTime: '10:00', toTime: '14:00' });
  const d = new Date('2026-11-02T00:00:00Z');
  assert.equal(matchesReportTime(d, new Date('2026-11-02T04:29:00Z'), q), false);
  assert.equal(matchesReportTime(d, new Date('2026-11-02T04:30:00Z'), q), true);
  assert.equal(matchesReportTime(d, new Date('2026-11-02T08:30:59Z'), q), true);
  assert.equal(matchesReportTime(d, new Date('2026-11-02T08:31:00Z'), q), false);
});

test('item totals match by variant, keep purchase-only and archived items, and avoid name collisions', () => {
  const catalog = [
    { id: 'small', name: 'Shirt', sku: 'S', size: 'S', category: 'Shirts' },
    { id: 'large', name: 'Shirt', sku: 'L', size: 'L', category: 'Shirts' },
    { id: 'unused', name: 'Unused', sku: 'U', size: '', category: 'Other' },
  ];
  const rows = summarizeItems(catalog, [
    { variantId: 'small', itemName: 'Shirt', sku: 'S', quantity: 2, total: 200 },
    { variantId: 'small', itemName: 'Shirt', sku: 'S', quantity: 3, total: 300 },
    { variantId: 'archived', itemName: 'Old Shirt', sku: 'OLD', quantity: 1, total: 75 },
  ], [ { variantId: 'large', name: 'Shirt', qty: 10, amount: 600 }, { variantId: 'small', name: 'Shirt', qty: 4, amount: 240 } ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.find(r => r.id === 'small'), { ...catalog[0], salesQty: 5, salesAmount: 500, purchaseQty: 4, purchaseAmount: 240 });
  assert.equal(rows.find(r => r.id === 'large')?.salesQty, 0);
  assert.equal(rows.find(r => r.id === 'large')?.purchaseQty, 10);
  assert.equal(rows.find(r => r.id === 'archived')?.salesAmount, 75);
  assert.deepEqual(summarizeItems(catalog, [], []), []);
});

 test('All removes both calendar and timestamp restrictions and ignores stale custom ranges', () => {
  const q = reportQuery.parse({ filter: 'All', from: '2026-11-01', to: '2026-11-02', fromTime: '10:00' });
  assert.equal(reportQuery.parse({}).filter, 'All');
  const bounds = reportBounds(q);
  assert.equal(bounds.where.gte, undefined);
  assert.equal(bounds.where.lt, undefined);
  assert.equal(bounds.timestampWhere.gte, undefined);
  assert.equal(bounds.timestampWhere.lt, undefined);
  assert.equal(matchesReportTime(new Date('2020-01-01'), new Date('2020-01-01'), q), true);
});
