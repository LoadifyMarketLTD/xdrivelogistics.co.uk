const express = require('express');
const { supabase } = require('../config/database');
const { checkAuth } = require('../middleware/auth');

const router = express.Router();

// List quotes
router.get('/', checkAuth, async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('quotes')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single quote
router.get('/:id', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Quote not found' });
  res.json(data);
});

// Create a quote
router.post('/', checkAuth, async (req, res) => {
  const {
    customer_name, customer_email, customer_phone,
    pickup_location, delivery_location,
    vehicle_type, cargo_type, amount, currency,
  } = req.body;

  const { data, error } = await supabase
    .from('quotes')
    .insert([{
      company_id: req.user.companyId,
      created_by: req.user.userId,
      customer_name,
      customer_email,
      customer_phone,
      pickup_location,
      delivery_location,
      vehicle_type,
      cargo_type,
      amount,
      currency: currency || 'GBP',
      status: 'draft',
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update a quote
router.put('/:id', checkAuth, async (req, res) => {
  const {
    customer_name, customer_email, customer_phone,
    pickup_location, delivery_location,
    vehicle_type, cargo_type, amount, currency, status,
  } = req.body;

  const { data, error } = await supabase
    .from('quotes')
    .update({
      customer_name, customer_email, customer_phone,
      pickup_location, delivery_location,
      vehicle_type, cargo_type, amount, currency, status,
    })
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Quote not found' });
  res.json(data);
});

// Delete a quote
router.delete('/:id', checkAuth, async (req, res) => {
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Convert quote to job
router.post('/:id/convert', checkAuth, async (req, res) => {
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .single();

  if (qErr || !quote) return res.status(404).json({ error: 'Quote not found' });

  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .insert([{
      company_id: req.user.companyId,
      created_by: req.user.userId,
      status: 'draft',
      vehicle_type: quote.vehicle_type,
      cargo_type: quote.cargo_type,
      pickup_location: quote.pickup_location,
      delivery_location: quote.delivery_location,
      budget_amount: quote.amount,
      currency: quote.currency,
    }])
    .select()
    .single();

  if (jErr) return res.status(500).json({ error: jErr.message });

  await supabase
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', req.params.id);

  res.status(201).json(job);
});

module.exports = router;
