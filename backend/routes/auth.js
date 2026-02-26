const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

const router = express.Router();

// Admin login via Supabase Auth
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Fetch profile to get company membership
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, full_name')
    .eq('id', data.user.id)
    .maybeSingle();

  const token = jwt.sign(
    {
      userId: data.user.id,
      companyId: profile?.company_id || null,
      role: profile?.role || 'admin',
      type: 'admin',
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: profile?.full_name || '',
      role: profile?.role || 'admin',
    },
  });
});

// Driver login (PIN-based)
router.post('/driver/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, display_name, company_id, app_access, login_pin')
    .eq('login_pin', pin)
    .eq('app_access', true)
    .maybeSingle();

  if (!driver) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  await supabase
    .from('drivers')
    .update({ last_app_login: new Date().toISOString() })
    .eq('id', driver.id);

  const token = jwt.sign(
    { driverId: driver.id, companyId: driver.company_id, type: 'driver' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    driver: {
      id: driver.id,
      name: driver.display_name,
    },
  });
});

module.exports = router;
