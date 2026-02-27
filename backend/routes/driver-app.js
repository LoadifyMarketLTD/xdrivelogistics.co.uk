const express = require('express');
const { supabase } = require('../config/database');
const { checkDriverAuth } = require('../middleware/auth');

const router = express.Router();

// Get driver profile and active job
router.get('/me', checkDriverAuth, async (req, res) => {
  const { data: driver, error } = await supabase
    .from('drivers')
    .select('id, display_name, phone, email, status')
    .eq('id', req.driverId)
    .single();

  if (error || !driver) return res.status(404).json({ error: 'Driver not found' });
  res.json(driver);
});

// Get jobs assigned to this driver
router.get('/jobs', checkDriverAuth, async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('jobs')
    .select('*')
    .eq('company_id', req.companyId)
    .eq('driver_id', req.driverId)
    .order('pickup_datetime', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.in('status', ['allocated', 'in_transit', 'draft']);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single job detail for driver
router.get('/jobs/:id', checkDriverAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, job_tracking_events(*)')
    .eq('id', req.params.id)
    .eq('company_id', req.companyId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Job not found' });
  res.json(data);
});

// Update job status (collect / deliver)
router.patch('/jobs/:id/status', checkDriverAuth, async (req, res) => {
  const { status, collection_photo_url, delivery_photos, delivery_signature_data, driver_notes, client_signature_name } = req.body;

  const allowed = ['allocated', 'in_transit', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updates = { status, driver_notes, client_signature_name };
  if (status === 'in_transit') {
    updates.collection_photo_url = collection_photo_url;
  }
  if (status === 'delivered') {
    updates.delivery_photos = delivery_photos;
    updates.delivery_signature_data = delivery_signature_data;
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', req.params.id)
    .eq('company_id', req.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Job not found' });

  // Record tracking event
  await supabase.from('job_tracking_events').insert([{
    job_id: req.params.id,
    event_type: status,
    message: `Status updated to ${status} by driver`,
    meta: { driver_id: req.driverId },
  }]);

  res.json(data);
});

// Update driver location
router.post('/location', checkDriverAuth, async (req, res) => {
  const { lat, lng, heading, speed_mph, job_id } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const { error } = await supabase
    .from('driver_locations')
    .insert({
      driver_id: req.driverId,
      company_id: req.companyId,
      job_id: job_id || null,
      lat,
      lng,
      heading: heading || null,
      speed_mph: speed_mph || null,
      recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
