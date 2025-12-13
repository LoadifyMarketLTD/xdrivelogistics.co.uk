-- XDrive Logistics Seed Data
-- Demo data for testing and development

-- Insert demo users
-- All passwords are 'password123' (bcrypt hashed with 10 rounds)
INSERT INTO users (account_type, email, password_hash, company_name, phone, status, created_at) VALUES
  ('shipper', 'shipper@demo.com', '$2b$10$EWdIN1rtYCHbZuXRbpCNRu7SR.YSRc0qcMeSjZg60KrnkIMxhMXFy', 'Demo Shipper Ltd', '+44 7700 900123', 'active', NOW()),
  ('driver', 'driver@demo.com', '$2b$10$EWdIN1rtYCHbZuXRbpCNRu7SR.YSRc0qcMeSjZg60KrnkIMxhMXFy', 'Demo Driver Co', '+44 7700 900456', 'active', NOW()),
  ('shipper', 'test@xdrive.com', '$2b$10$EWdIN1rtYCHbZuXRbpCNRu7SR.YSRc0qcMeSjZg60KrnkIMxhMXFy', 'XDrive Test', '+44 7700 900789', 'active', NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert demo bookings with realistic data
INSERT INTO bookings (load_id, from_address, to_address, vehicle_type, pickup_date, delivery_date, price, subcontract_cost, status, completed_by, created_at) VALUES
  ('XD-2024-001', 'London, SE1 9SG, UK', 'Manchester, M1 1AE, UK', 'Luton Van', '2024-12-01', '2024-12-01', 250.00, 180.00, 'delivered', 'John Smith Logistics', '2024-12-01 08:00:00'),
  ('XD-2024-002', 'Birmingham, B1 1AA, UK', 'Leeds, LS1 1BA, UK', 'Transit Van', '2024-12-02', '2024-12-02', 180.00, 120.00, 'delivered', 'Fast Track Couriers', '2024-12-02 09:00:00'),
  ('XD-2024-003', 'Bristol, BS1 4DJ, UK', 'Cardiff, CF10 1EP, UK', 'Sprinter Van', '2024-12-03', '2024-12-03', 120.00, 85.00, 'delivered', 'Quick Move Ltd', '2024-12-03 10:00:00'),
  ('XD-2024-004', 'Glasgow, G1 1AA, UK', 'Edinburgh, EH1 1YZ, UK', 'Luton Van', '2024-12-04', '2024-12-04', 95.00, 65.00, 'delivered', 'Scotland Express', '2024-12-04 07:30:00'),
  ('XD-2024-005', 'Liverpool, L1 1JD, UK', 'Newcastle, NE1 1EE, UK', 'Transit Van', '2024-12-05', '2024-12-05', 220.00, 160.00, 'delivered', 'North West Deliveries', '2024-12-05 08:00:00'),
  ('XD-2024-006', 'Sheffield, S1 1DA, UK', 'Nottingham, NG1 1AA, UK', 'Sprinter Van', '2024-12-06', '2024-12-06', 85.00, 55.00, 'delivered', 'Midlands Transport', '2024-12-06 09:30:00'),
  ('XD-2024-007', 'Southampton, SO14 7DY, UK', 'Portsmouth, PO1 2AA, UK', 'Luton Van', '2024-12-07', '2024-12-07', 65.00, 40.00, 'delivered', 'South Coast Logistics', '2024-12-07 11:00:00'),
  ('XD-2024-008', 'Oxford, OX1 1BX, UK', 'Cambridge, CB2 1TN, UK', 'Transit Van', '2024-12-08', '2024-12-08', 195.00, 145.00, 'delivered', 'University Courier Services', '2024-12-08 08:15:00'),
  ('XD-2024-009', 'Brighton, BN1 1AA, UK', 'London, W1A 1AA, UK', 'Sprinter Van', '2024-12-09', '2024-12-09', 145.00, 95.00, 'delivered', 'Metro Express', '2024-12-09 07:00:00'),
  ('XD-2024-010', 'York, YO1 7HH, UK', 'Hull, HU1 1AA, UK', 'Luton Van', '2024-12-10', '2024-12-10', 110.00, 75.00, 'delivered', 'Yorkshire Transport', '2024-12-10 10:00:00'),
  ('XD-2024-011', 'Coventry, CV1 1GF, UK', 'Leicester, LE1 1AA, UK', 'Transit Van', '2024-12-11', '2024-12-11', 75.00, 50.00, 'delivered', 'Central England Couriers', '2024-12-11 09:00:00'),
  ('XD-2024-012', 'Exeter, EX1 1AA, UK', 'Plymouth, PL1 1AA, UK', 'Sprinter Van', '2024-12-12', '2024-12-12', 90.00, 60.00, 'delivered', 'Devon Direct', '2024-12-12 08:30:00'),
  ('XD-2024-013', 'London, EC1A 1BB, UK', 'Birmingham, B2 4AA, UK', 'Luton Van', '2024-12-13', '2024-12-13', 210.00, 155.00, 'in_transit', 'Express Line Ltd', '2024-12-13 06:00:00'),
  ('XD-2024-014', 'Manchester, M60 1NW, UK', 'Liverpool, L3 9AG, UK', 'Transit Van', '2024-12-14', NULL, 95.00, 70.00, 'confirmed', 'North West Network', '2024-12-13 15:00:00'),
  ('XD-2024-015', 'Cardiff, CF24 0AB, UK', 'Swansea, SA1 1AA, UK', 'Sprinter Van', '2024-12-15', NULL, 80.00, 55.00, 'pending', NULL, '2024-12-13 16:00:00')
ON CONFLICT (load_id) DO NOTHING;

-- Insert demo invoices
INSERT INTO invoices (booking_id, invoice_number, amount, due_date, status, created_at) VALUES
  (1, 'INV-2024-001', 250.00, '2024-12-15', 'paid', '2024-12-01 18:00:00'),
  (2, 'INV-2024-002', 180.00, '2024-12-16', 'paid', '2024-12-02 18:00:00'),
  (3, 'INV-2024-003', 120.00, '2024-12-17', 'paid', '2024-12-03 18:00:00'),
  (4, 'INV-2024-004', 95.00, '2024-12-18', 'sent', '2024-12-04 18:00:00'),
  (5, 'INV-2024-005', 220.00, '2024-12-19', 'pending', '2024-12-05 18:00:00')
ON CONFLICT (invoice_number) DO NOTHING;

-- Insert demo feedback
INSERT INTO feedback (user_id, booking_id, rating, comment, created_at) VALUES
  (2, 1, 5, 'Excellent service, on time delivery!', '2024-12-01 20:00:00'),
  (2, 2, 4, 'Good service, slight delay but communicated well.', '2024-12-02 19:00:00'),
  (2, 3, 5, 'Perfect delivery, professional driver.', '2024-12-03 21:00:00'),
  (2, 4, 5, 'Great service, would recommend.', '2024-12-04 18:30:00'),
  (2, 5, 4, 'Good overall, minor packaging issue but resolved quickly.', '2024-12-05 20:00:00');

-- Insert demo watchlist entries
INSERT INTO watchlist (user_id, entity_type, entity_id, notes, created_at) VALUES
  (1, 'route', 1, 'High volume London-Manchester route', '2024-12-01 10:00:00'),
  (1, 'partner', 2, 'Reliable driver, always on time', '2024-12-02 11:00:00'),
  (2, 'route', 3, 'Regular Birmingham-Leeds run', '2024-12-03 09:00:00');

-- Display summary
SELECT 'Database seeded successfully!' AS message;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS booking_count FROM bookings;
SELECT COUNT(*) AS invoice_count FROM invoices;
SELECT COUNT(*) AS feedback_count FROM feedback;
SELECT COUNT(*) AS watchlist_count FROM watchlist;

-- Display gross margin summary
SELECT 
  COUNT(*) as total_delivered,
  SUM(price) as total_revenue,
  SUM(subcontract_cost) as total_subcontract_cost,
  SUM(price - COALESCE(subcontract_cost, 0)) as gross_margin,
  ROUND(100.0 * SUM(price - COALESCE(subcontract_cost, 0)) / NULLIF(SUM(price), 0), 2) as margin_percentage
FROM bookings
WHERE status = 'delivered';
