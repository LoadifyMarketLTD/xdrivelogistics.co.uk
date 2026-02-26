const express = require('express');
const { supabase } = require('../config/database');
const { checkAuth } = require('../middleware/auth');

const router = express.Router();

// List jobs with optional filters
router.get('/', checkAuth, async (req, res) => {
  const { status, driver_id, date } = req.query;

  let query = supabase
    .from('jobs')
    .select('*, drivers(display_name), vehicles(reg_plate, type)')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (driver_id) query = query.eq('driver_id', driver_id);
  if (date) {
    query = query.gte('pickup_datetime', `${date}T00:00:00.000Z`).lt('pickup_datetime', `${date}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single job
router.get('/:id', checkAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, drivers(display_name, phone), vehicles(reg_plate, type), job_tracking_events(*)')
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Job not found' });
  res.json(data);
});

// Create a job
router.post('/', checkAuth, async (req, res) => {
  const {
    driver_id, vehicle_id, status, vehicle_type, cargo_type,
    pickup_location, pickup_postcode, pickup_datetime,
    delivery_location, delivery_postcode, delivery_datetime,
    weight_kg, load_details, special_requirements, budget_amount,
  } = req.body;

  const { data, error } = await supabase
    .from('jobs')
    .insert([{
      company_id: req.user.companyId,
      created_by: req.user.userId,
      driver_id,
      vehicle_id,
      status: status || 'draft',
      vehicle_type,
      cargo_type,
      pickup_location,
      pickup_postcode,
      pickup_datetime,
      delivery_location,
      delivery_postcode,
      delivery_datetime,
      weight_kg,
      load_details,
      special_requirements,
      budget_amount,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update a job
router.put('/:id', checkAuth, async (req, res) => {
  const {
    driver_id, vehicle_id, status, vehicle_type, cargo_type,
    pickup_location, pickup_postcode, pickup_datetime,
    delivery_location, delivery_postcode, delivery_datetime,
    weight_kg, load_details, special_requirements, budget_amount,
  } = req.body;

  const { data, error } = await supabase
    .from('jobs')
    .update({
      driver_id, vehicle_id, status, vehicle_type, cargo_type,
      pickup_location, pickup_postcode, pickup_datetime,
      delivery_location, delivery_postcode, delivery_datetime,
      weight_kg, load_details, special_requirements, budget_amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Job not found' });
  res.json(data);
});

// Delete a job
router.delete('/:id', checkAuth, async (req, res) => {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Dashboard stats
router.get('/stats/dashboard', checkAuth, async (req, res) => {
  const companyId = req.user.companyId;
  const today = new Date().toISOString().split('T')[0];

  const [active, pending, drivers, delivered] = await Promise.all([
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['allocated', 'in_transit']),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'draft'),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'delivered').gte('updated_at', today),
  ]);

  res.json({
    activeJobs: active.count || 0,
    pendingJobs: pending.count || 0,
    activeDrivers: drivers.count || 0,
    completedToday: delivered.count || 0,
  });
});

module.exports = router;
