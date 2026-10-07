import assert from 'node:assert/strict';
import { salesNumberFloor } from '../server/sales-numbering.js';

const live = 'cmti1m17y0001w4zwwin3hmr8';
const prefix = 'HB/SL/26-27/';
assert.equal(salesNumberFloor(live, prefix), 1763);
assert.equal(salesNumberFloor('cmsdd5qr70001w4rooebz5yxo', prefix), 1763);
assert.equal(salesNumberFloor('cmtgun1pn0005w4fcala3r2v5', prefix), 1);
assert.equal(salesNumberFloor('cmu7lp2da0001w478ry6fra25', prefix), 1);
assert.equal(salesNumberFloor(live, 'HB/SL/27-28/'), 1);
assert.equal(salesNumberFloor(live, 'OTHER/26-27/'), 1);
assert.equal(Math.max(1, 17, salesNumberFloor(live, prefix)), 1763);
assert.equal(Math.max(1764, 1764, salesNumberFloor(live, prefix)), 1764);
assert.equal(Math.max(1800, 1780, salesNumberFloor(live, prefix)), 1800);
console.log('Sales starting number checks passed.');
