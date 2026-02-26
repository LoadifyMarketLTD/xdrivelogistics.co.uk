const express = require('express');
const { supabase } = require('../config/database');
const { checkAuth } = require('../middleware/auth');

const router = express.Router();

// List all vehicles for the company
router.get('/', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, drivers(display_name)')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single vehicle
router.get('/:id', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, drivers(display_name)')
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
});

// Create a vehicle
router.post('/', checkAuth, async (req, res) => {
  const { assigned_driver_id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'type is required' });
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert([{
      company_id: req.user.companyId,
      assigned_driver_id,
      type,
      reg_plate,
      make,
      model,
      payload_kg,
      pallets_capacity,
      has_tail_lift: has_tail_lift || false,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update a vehicle
router.put('/:id', checkAuth, async (req, res) => {
  const { assigned_driver_id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift } = req.body;

  const { data, error } = await supabase
    .from('vehicles')
    .update({ assigned_driver_id, type, reg_plate, make, model, payload_kg, pallets_capacity, has_tail_lift })
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
});

// Delete a vehicle
router.delete('/:id', checkAuth, async (req, res) => {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
