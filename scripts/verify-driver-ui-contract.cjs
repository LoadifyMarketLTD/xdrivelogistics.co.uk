#!/usr/bin/env node
/**
 * Driver PWA calibration gate.
 * Run locally: node scripts/verify-driver-ui-contract.cjs
 * This gate MUST NOT auto-approve missing screenshot sources or measurements.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'driver-ui-contract.json'), 'utf8'));
const expected = { SHELL: 8, JOB: 20, QUOTE: 9, BOOK: 10, DETAIL: 19, MORE: 10 };
const errors = [];
if (contract.status !== 'CALIBRATED_AND_APPROVED') errors.push('Contract is not CALIBRATED_AND_APPROVED.');
if (Object.keys(contract.screenshots || {}).length !== 19) errors.push('Expected exactly 19 CX screenshot records.');
for (let n = 1; n <= 19; n++) {
  const id = 'CX-' + String(n).padStart(2, '0');
  const image = contract.screenshots?.[id];
  if (!image || image.status !== 'CALIBRATED' || !image.sha256 || !image.viewport || !image.dpr) {
    errors.push(id + ' original source/viewport/DPR is not calibrated.');
  }
}
for (const [prefix, count] of Object.entries(expected)) {
  for (let n = 1; n <= count; n++) {
    const id = prefix + '-' + String(n).padStart(2, '0');
    const item = contract.components?.[id];
    if (!item || item.status !== 'APPROVED' || !item.source_image ||
        !item.css_rect || item.tolerance_px == null || !item.selector) {
      errors.push(id + ' lacks an approved image-backed geometry/test selector.');
    }
  }
}
if (errors.length) {
  console.error('Driver UI contract: FAIL (' + errors.length + ' calibration gaps)');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}
console.log('Driver UI contract: structural calibration gate PASS. Run the required visual and operational E2E checks separately.');
