const express = require('express');
const { supabase } = require('../config/database');
const { checkAuth } = require('../middleware/auth');

const router = express.Router();

// List companies visible to the authenticated user (scoped by membership)
router.get('/', checkAuth, async (req, res) => {
  // Get company IDs the user is a member of
  const { data: memberships, error: mErr } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', req.user.userId)
    .eq('status', 'active');

  if (mErr) return res.status(500).json({ error: mErr.message });

  const companyIds = (memberships || []).map(m => m.company_id).filter(Boolean);

  // Also include the company from the JWT if set
  if (req.user.companyId && !companyIds.includes(req.user.companyId)) {
    companyIds.push(req.user.companyId);
  }

  if (companyIds.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .in('id', companyIds)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Get a single company (must be a member)
router.get('/:id', checkAuth, async (req, res) => {
  const { data: membership } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('company_id', req.params.id)
    .eq('user_id', req.user.userId)
    .eq('status', 'active')
    .maybeSingle();

  const allowed = membership || req.user.companyId === req.params.id;
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Company not found' });
  res.json(data);
});

// Update a company (must be admin/owner)
router.put('/:id', checkAuth, async (req, res) => {
  const { data: membership } = await supabase
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', req.params.id)
    .eq('user_id', req.user.userId)
    .eq('status', 'active')
    .maybeSingle();

  const isAdmin = membership && ['owner', 'admin'].includes(membership.role_in_company);
  const isCompanyOwner = req.user.companyId === req.params.id;
  if (!isAdmin && !isCompanyOwner) return res.status(403).json({ error: 'Forbidden' });
  const {
    name, company_number, vat_number, email, phone,
    address_line1, address_line2, city, postcode, country,
  } = req.body;

  const { data, error } = await supabase
    .from('companies')
    .update({ name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Company not found' });
  res.json(data);
});

module.exports = router;
