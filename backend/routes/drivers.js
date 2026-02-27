const express = require('express');
const { supabase } = require('../config/database');
const { checkAuth } = require('../middleware/auth');

const router = express.Router();

// List all drivers for the company
router.get('/', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single driver
router.get('/:id', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Driver not found' });
  res.json(data);
});

// Create a driver
router.post('/', checkAuth, async (req, res) => {
  const { display_name, phone, email, status } = req.body;
  if (!display_name) {
    return res.status(400).json({ error: 'display_name is required' });
  }

  const { data, error } = await supabase
    .from('drivers')
    .insert([{ company_id: req.user.companyId, display_name, phone, email, status: status || 'active' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update a driver
router.put('/:id', checkAuth, async (req, res) => {
  const { display_name, phone, email, status, login_pin, app_access } = req.body;

  const { data, error } = await supabase
    .from('drivers')
    .update({ display_name, phone, email, status, login_pin, app_access })
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Driver not found' });
  res.json(data);
});

// Delete a driver
router.delete('/:id', checkAuth, async (req, res) => {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
