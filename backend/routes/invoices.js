const express = require('express');
const { supabase } = require('../config/database');
const { checkAuth } = require('../middleware/auth');

const router = express.Router();

// List invoices
router.get('/', checkAuth, async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('invoices')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single invoice
router.get('/:id', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Invoice not found' });
  res.json(data);
});

// Create an invoice
router.post('/', checkAuth, async (req, res) => {
  const {
    invoice_number, job_ref, job_id, invoice_date, due_date,
    client_name, client_address, client_email,
    pickup_location, pickup_datetime, delivery_location, delivery_datetime,
    delivery_recipient, service_description,
    amount, net_amount, vat_amount, vat_rate, currency,
    payment_terms, late_fee, pod_photos, signature, recipient_name,
    status,
  } = req.body;

  if (!invoice_number || !client_name) {
    return res.status(400).json({ error: 'invoice_number and client_name are required' });
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert([{
      company_id: req.user.companyId,
      created_by: req.user.userId,
      invoice_number, job_ref, job_id, invoice_date, due_date,
      client_name, client_address, client_email,
      pickup_location, pickup_datetime, delivery_location, delivery_datetime,
      delivery_recipient, service_description,
      amount, net_amount, vat_amount, vat_rate: vat_rate || 20,
      currency: currency || 'GBP',
      payment_terms: payment_terms || '14 days',
      late_fee, pod_photos, signature, recipient_name,
      status: status || 'Pending',
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update an invoice
router.put('/:id', checkAuth, async (req, res) => {
  const {
    invoice_date, due_date, client_name, client_address, client_email,
    pickup_location, pickup_datetime, delivery_location, delivery_datetime,
    delivery_recipient, service_description,
    amount, net_amount, vat_amount, vat_rate, currency,
    payment_terms, late_fee, pod_photos, signature, recipient_name,
    status,
  } = req.body;

  const { data, error } = await supabase
    .from('invoices')
    .update({
      invoice_date, due_date, client_name, client_address, client_email,
      pickup_location, pickup_datetime, delivery_location, delivery_datetime,
      delivery_recipient, service_description,
      amount, net_amount, vat_amount, vat_rate, currency,
      payment_terms, late_fee, pod_photos, signature, recipient_name,
      status, updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Invoice not found' });
  res.json(data);
});

// Delete an invoice
router.delete('/:id', checkAuth, async (req, res) => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
