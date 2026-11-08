import test from 'node:test'
import assert from 'node:assert/strict'
import { JOB_FLOW, nextJobStatus, validateTransition, validateQuote } from '../src/workflow.ts'
import { invoiceTotals, validateInvoice } from '../src/invoice.ts'

test('complete allocated-to-delivered workflow', () => {
  let status = JOB_FLOW[0]
  for (const target of JOB_FLOW.slice(1)) {
    const context = { customerReference: 'COL-001', recipientName: 'Test Recipient', hasPodEvidence: true }
    assert.equal(validateTransition(status, target, context), null)
    status = target
  }
  assert.equal(status, 'DELIVERED')
  assert.equal(nextJobStatus(status), undefined)
})
test('cannot transition an unawarded open job', () => {
  assert.equal(nextJobStatus('OPEN'), undefined)
  assert.match(validateTransition('OPEN', 'ALLOCATED', {}), /Invalid/)
})
test('cannot skip booking states', () => {
  assert.match(validateTransition('ALLOCATED', 'DELIVERED', {}), /Invalid/)
})
test('loading requires collection reference', () => {
  assert.match(validateTransition('ON_SITE_PICKUP', 'LOADED', {}), /reference/)
})
test('POD requires recipient and evidence flag', () => {
  assert.match(validateTransition('ON_SITE_DELIVERY', 'POD_SUBMITTED', { hasPodEvidence: true }), /Recipient/)
  assert.match(validateTransition('ON_SITE_DELIVERY', 'POD_SUBMITTED', { recipientName: 'A' }), /evidence/)
  assert.equal(validateTransition('ON_SITE_DELIVERY', 'POD_SUBMITTED', { recipientName: 'A', hasPodEvidence: true }), null)
})
test('quote amounts reject invalid and precision errors', () => {
  for (const amount of [-1, 0, Number.NaN, Infinity, 1.001]) assert.notEqual(validateQuote(amount), null)
  for (const amount of [0.01, 12.50, 200]) assert.equal(validateQuote(amount), null)
})
test('invoice calculations use integer pence', () => {
  const draft = { invoiceNumber: 'TEST-INV-1', jobId: 'TEST-1', issuerName: 'A', customerName: 'B', issuedOn: '2026-11-05', netPence: 38100, vatRate: 20, paymentTerms: 'End of month' }
  assert.equal(validateInvoice(draft), null)
  assert.deepEqual(invoiceTotals(draft), { netPence: 38100, vatPence: 7620, grossPence: 45720 })
  assert.equal(invoiceTotals({ ...draft, vatRate: 0 }).grossPence, 38100)
  assert.notEqual(validateInvoice({ ...draft, customerName: '' }), null)
})
