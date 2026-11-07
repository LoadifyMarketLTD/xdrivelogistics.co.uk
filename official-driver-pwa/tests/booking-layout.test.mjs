import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
const bookingDocuments = readFileSync(new URL('../src/BookingDocuments.tsx', import.meta.url), 'utf8');
test('all booking records use the same details renderer, regardless of fixture id', () => {
  assert.match(source, /const openJob = \(id: string\) => \{[^\n]*setBookingScreen\("details"\)/);
  assert.match(source, /onClick=\{\(\) => openJob\(j\.id\)\}/);
  assert.match(source, /job\.status !== "OPEN" && bookingScreen === "details" && <section className="booking-detail-sheet booking-detail-redesign">/);
  assert.doesNotMatch(source, /job\.id === "TEST-1099" && bookingScreen/);
});
test('booking details do not use a nested generic card frame', () => {
  assert.match(source, /bookingScreen === "details" \? "booking-details-root" : tab === "Quotes" \? "card quote-green-card quote-green-details" : "card"/);
  assert.match(css, /\.booking-details-root\{[^}]*border:0!important/);
});
test('booking details share the complete Post Load sections and document action', () => {
  for (const section of ['Collection Details', 'Delivery Details', 'Cargo & Job Details', 'AGREED RATE', 'DISTANCE', 'PAYMENT TERMS', 'Documents']) assert.ok(source.includes(section), section);
  assert.match(source, /<BookingDocuments key=\{job.id\} jobId=\{job.id\}/);
  assert.ok(bookingDocuments.includes('+ Attach document'));
  assert.ok(bookingDocuments.includes('Save documents'));
  assert.ok(bookingDocuments.includes('x-xdrive-evidence-category'));
  assert.doesNotMatch(source, /local record only; file not retained after reload/);
  assert.doesNotMatch(source, /<h3>Route Stops<\/h3>/);
});
