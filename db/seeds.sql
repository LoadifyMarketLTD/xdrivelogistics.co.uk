-- XDrive Logistics Seed Data
-- Demo data for testing and development

-- Insert demo users
-- NOTE: These are DEMO accounts for development/testing ONLY
-- In production, use environment-specific seed data or create accounts via API
-- Password for all demo accounts: password123 (hash is intentionally predictable for testing)
INSERT INTO users (account_type, email, password_hash, status, created_at) VALUES
  ('shipper', 'shipper@xdrive.test', '$2b$10$XqGkz8Z9J1q0J9J9J9J9Ju7X8J9J9J9J9J9J9J9J9J9J9J9J9J9J9', 'active', NOW()),
  ('driver', 'driver@xdrive.test', '$2b$10$XqGkz8Z9J1q0J9J9J9J9Ju7X8J9J9J9J9J9J9J9J9J9J9J9J9J9J9', 'active', NOW()),
  ('driver', 'john.driver@xdrive.test', '$2b$10$XqGkz8Z9J1q0J9J9J9J9Ju7X8J9J9J9J9J9J9J9J9J9J9J9J9J9J9', 'active', NOW());

-- Insert sample bookings based on user's data
INSERT INTO bookings (load_id, from_location, to_location, vehicle_type, pickup_date, delivery_date, price, subcontract_cost, status, completed_by, created_at) VALUES
  ('LD-2025-001', 'London, UK', 'Manchester, UK', 'Van', '2025-01-15 08:00:00+00', '2025-01-15 14:00:00+00', 450.00, 320.00, 'delivered', 'John Transport Ltd', '2025-01-10 10:00:00+00'),
  ('LD-2025-002', 'Birmingham, UK', 'Leeds, UK', 'Luton Van', '2025-01-16 09:00:00+00', '2025-01-16 15:30:00+00', 380.00, 280.00, 'delivered', 'Swift Logistics', '2025-01-11 11:30:00+00'),
  ('LD-2025-003', 'Bristol, UK', 'Cardiff, Wales', 'Van', '2025-01-17 07:00:00+00', '2025-01-17 10:00:00+00', 250.00, 180.00, 'delivered', 'Wales Express', '2025-01-12 09:15:00+00'),
  ('LD-2025-004', 'Glasgow, Scotland', 'Edinburgh, Scotland', 'Transit Van', '2025-01-18 08:30:00+00', '2025-01-18 11:00:00+00', 280.00, 200.00, 'delivered', 'Scottish Couriers', '2025-01-13 14:20:00+00'),
  ('LD-2025-005', 'Southampton, UK', 'Portsmouth, UK', 'Van', '2025-01-19 10:00:00+00', '2025-01-19 12:30:00+00', 180.00, 120.00, 'delivered', 'South Coast Transport', '2025-01-14 08:45:00+00'),
  ('LD-2025-006', 'Newcastle, UK', 'Sunderland, UK', 'Van', '2025-01-20 09:00:00+00', '2025-01-20 11:00:00+00', 160.00, 110.00, 'delivered', 'North East Deliveries', '2025-01-15 10:30:00+00'),
  ('LD-2025-007', 'Liverpool, UK', 'Chester, UK', 'Luton Van', '2025-01-21 08:00:00+00', '2025-01-21 10:30:00+00', 220.00, 150.00, 'delivered', 'Mersey Transport', '2025-01-16 11:00:00+00'),
  ('LD-2025-008', 'Nottingham, UK', 'Derby, UK', 'Van', '2025-01-22 07:30:00+00', '2025-01-22 09:00:00+00', 140.00, 95.00, 'delivered', 'Midlands Express', '2025-01-17 09:20:00+00'),
  ('LD-2025-009', 'Oxford, UK', 'Reading, UK', 'Van', '2025-01-23 10:00:00+00', '2025-01-23 12:00:00+00', 200.00, 140.00, 'delivered', 'Thames Valley Transport', '2025-01-18 13:45:00+00'),
  ('LD-2025-010', 'Cambridge, UK', 'Norwich, UK', 'Transit Van', '2025-01-24 08:00:00+00', '2025-01-24 11:30:00+00', 320.00, 230.00, 'delivered', 'East Anglia Logistics', '2025-01-19 08:00:00+00'),
  ('LD-2025-011', 'Sheffield, UK', 'Doncaster, UK', 'Van', '2025-01-25 09:00:00+00', '2025-01-25 11:00:00+00', 170.00, 120.00, 'delivered', 'Yorkshire Transport', '2025-01-20 10:15:00+00'),
  ('LD-2025-012', 'Plymouth, UK', 'Exeter, UK', 'Van', '2025-01-26 07:00:00+00', '2025-01-26 09:30:00+00', 240.00, 170.00, 'delivered', 'Devon Deliveries', '2025-01-21 11:30:00+00'),
  ('LD-2025-013', 'London, UK', 'Brighton, UK', 'Luton Van', '2025-01-27 10:00:00+00', '2025-01-27 13:00:00+00', 290.00, 200.00, 'delivered', 'South Coast Express', '2025-01-22 09:00:00+00'),
  ('LD-2025-014', 'Leeds, UK', 'York, UK', 'Van', '2025-01-28 08:30:00+00', '2025-01-28 10:00:00+00', 150.00, 105.00, 'delivered', 'Yorkshire Couriers', '2025-01-23 14:00:00+00'),
  ('LD-2025-015', 'Manchester, UK', 'Liverpool, UK', 'Van', '2025-01-29 09:00:00+00', '2025-01-29 11:00:00+00', 190.00, 135.00, 'delivered', 'Northwest Transport', '2025-01-24 10:45:00+00'),
  
  -- Some pending/in-transit bookings
  ('LD-2025-016', 'London, UK', 'Birmingham, UK', 'Van', '2025-02-01 08:00:00+00', NULL, 350.00, NULL, 'pending', NULL, NOW()),
  ('LD-2025-017', 'Edinburgh, Scotland', 'Aberdeen, Scotland', 'Transit Van', '2025-02-02 09:00:00+00', NULL, 420.00, NULL, 'confirmed', NULL, NOW()),
  ('LD-2025-018', 'Cardiff, Wales', 'Swansea, Wales', 'Van', '2025-02-03 07:00:00+00', NULL, 210.00, 150.00, 'in_transit', 'Welsh Transport', NOW());

-- Insert sample invoices for delivered bookings
INSERT INTO invoices (booking_id, invoice_number, amount, due_date, status, created_at) VALUES
  (1, 'INV-2025-001', 450.00, '2025-02-15', 'paid', '2025-01-16 10:00:00+00'),
  (2, 'INV-2025-002', 380.00, '2025-02-16', 'paid', '2025-01-17 11:00:00+00'),
  (3, 'INV-2025-003', 250.00, '2025-02-17', 'sent', '2025-01-18 09:00:00+00'),
  (4, 'INV-2025-004', 280.00, '2025-02-18', 'sent', '2025-01-19 10:00:00+00'),
  (5, 'INV-2025-005', 180.00, '2025-02-19', 'paid', '2025-01-20 08:00:00+00'),
  (6, 'INV-2025-006', 160.00, '2025-02-20', 'pending', '2025-01-21 09:00:00+00'),
  (7, 'INV-2025-007', 220.00, '2025-02-21', 'sent', '2025-01-22 10:00:00+00'),
  (8, 'INV-2025-008', 140.00, '2025-02-22', 'paid', '2025-01-23 11:00:00+00'),
  (9, 'INV-2025-009', 200.00, '2025-02-23', 'sent', '2025-01-24 12:00:00+00'),
  (10, 'INV-2025-010', 320.00, '2025-02-24', 'paid', '2025-01-25 09:00:00+00');

-- Insert sample feedback
INSERT INTO feedback (user_id, booking_id, rating, comment, created_at) VALUES
  (1, 1, 5, 'Excellent service, delivered on time!', '2025-01-16 15:00:00+00'),
  (1, 2, 4, 'Good service, minor delay but kept us informed.', '2025-01-17 16:00:00+00'),
  (1, 3, 5, 'Very professional and careful with cargo.', '2025-01-18 12:00:00+00'),
  (2, 4, 5, 'Great experience, would recommend!', '2025-01-19 13:00:00+00'),
  (2, 5, 4, 'Reliable and punctual.', '2025-01-20 14:00:00+00');

-- Insert sample watchlist entries
INSERT INTO watchlist (user_id, watched_user_id, route_from, route_to, notes, created_at) VALUES
  (1, 2, 'London', 'Manchester', 'Reliable driver for this route', NOW()),
  (1, 3, 'Birmingham', 'Leeds', 'Competitive pricing', NOW()),
  (2, NULL, 'London', 'Edinburgh', 'Frequently available route', NOW());

-- Display summary
DO $$
DECLARE
  user_count INTEGER;
  booking_count INTEGER;
  delivered_count INTEGER;
  total_revenue NUMERIC;
  total_margin NUMERIC;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO booking_count FROM bookings;
  SELECT COUNT(*) INTO delivered_count FROM bookings WHERE status = 'delivered';
  SELECT SUM(price) INTO total_revenue FROM bookings WHERE status = 'delivered';
  SELECT SUM(price - COALESCE(subcontract_cost, 0)) INTO total_margin FROM bookings WHERE status = 'delivered';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '  XDrive Logistics - Database Seeded';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'Users created: %', user_count;
  RAISE NOTICE 'Total bookings: %', booking_count;
  RAISE NOTICE 'Delivered bookings: %', delivered_count;
  RAISE NOTICE 'Total revenue: £%', total_revenue;
  RAISE NOTICE 'Gross margin: £%', total_margin;
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
INSERT INTO users (account_type, email, password_hash, full_name, company_name, status, created_at, updated_at)
VALUES 
  ('shipper', 'shipper@demo.com', '$2b$10$rQ8l3KZ7vXwZ5VqB6Nz5Ku8X7Y5Q3Z1V2W3Q4Z5Y6X7V8W9Q0Z1Y2', 'John Smith', 'ABC Logistics Ltd', 'active', NOW(), NOW()),
  ('driver', 'driver@demo.com', '$2b$10$rQ8l3KZ7vXwZ5VqB6Nz5Ku8X7Y5Q3Z1V2W3Q4Z5Y6X7V8W9Q0Z1Y2', 'Mike Johnson', 'Fast Delivery Co', 'active', NOW(), NOW()),
  ('shipper', 'admin@xdrive.com', '$2b$10$rQ8l3KZ7vXwZ5VqB6Nz5Ku8X7Y5Q3Z1V2W3Q4Z5Y6X7V8W9Q0Z1Y2', 'Admin User', 'XDrive Logistics', 'active', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Note: password for all demo users is 'password123' (hashed with bcrypt)

-- Insert sample bookings with varied data reflecting real usage
INSERT INTO bookings (load_id, from_address, to_address, vehicle_type, pickup_date, delivery_date, status, price, subcontract_cost, completed_by, created_at, updated_at)
VALUES
  -- December 2024 deliveries
  ('LOAD-001', 'London, EC1A 1BB, UK', 'Manchester, M1 1AE, UK', 'Van', '2024-12-01', '2024-12-01', 'delivered', 450.00, 320.00, 'Mike Johnson', '2024-12-01 08:00:00', '2024-12-01 18:00:00'),
  ('LOAD-002', 'Birmingham, B1 1AA, UK', 'Leeds, LS1 1BA, UK', 'Luton Van', '2024-12-02', '2024-12-02', 'delivered', 380.00, 280.00, 'Sarah Wilson', '2024-12-02 09:00:00', '2024-12-02 17:30:00'),
  ('LOAD-003', 'Bristol, BS1 1AA, UK', 'Cardiff, CF10 1AA, UK', 'Van', '2024-12-03', '2024-12-03', 'delivered', 290.00, 210.00, 'Tom Brown', '2024-12-03 07:30:00', '2024-12-03 14:00:00'),
  ('LOAD-004', 'Liverpool, L1 1AA, UK', 'Newcastle, NE1 1AA, UK', 'Long Wheel Base Van', '2024-12-04', '2024-12-04', 'delivered', 520.00, 380.00, 'Mike Johnson', '2024-12-04 06:00:00', '2024-12-04 16:00:00'),
  ('LOAD-005', 'Southampton, SO14 0AA, UK', 'London, SW1A 1AA, UK', 'Van', '2024-12-05', '2024-12-05', 'delivered', 350.00, 250.00, 'Emma Davis', '2024-12-05 10:00:00', '2024-12-05 15:00:00'),
  
  -- Week of Dec 8-14, 2024
  ('LOAD-006', 'Edinburgh, EH1 1AA, UK', 'Glasgow, G1 1AA, UK', 'Van', '2024-12-08', '2024-12-08', 'delivered', 280.00, 200.00, 'James Clark', '2024-12-08 08:00:00', '2024-12-08 13:00:00'),
  ('LOAD-007', 'Sheffield, S1 1AA, UK', 'Nottingham, NG1 1AA, UK', 'Luton Van', '2024-12-09', '2024-12-09', 'delivered', 320.00, 240.00, 'Mike Johnson', '2024-12-09 09:00:00', '2024-12-09 14:30:00'),
  ('LOAD-008', 'Oxford, OX1 1AA, UK', 'Cambridge, CB1 1AA, UK', 'Van', '2024-12-10', '2024-12-10', 'delivered', 410.00, 300.00, 'Sarah Wilson', '2024-12-10 07:00:00', '2024-12-10 15:00:00'),
  ('LOAD-009', 'Plymouth, PL1 1AA, UK', 'Exeter, EX1 1AA, UK', 'Van', '2024-12-11', '2024-12-11', 'delivered', 260.00, 190.00, 'Tom Brown', '2024-12-11 11:00:00', '2024-12-11 16:00:00'),
  ('LOAD-010', 'Brighton, BN1 1AA, UK', 'Portsmouth, PO1 1AA, UK', 'Long Wheel Base Van', '2024-12-12', '2024-12-12', 'delivered', 340.00, 260.00, 'Emma Davis', '2024-12-12 08:30:00', '2024-12-12 14:00:00'),
  
  -- January 2025 bookings
  ('LOAD-011', 'London, W1A 1AA, UK', 'Birmingham, B2 4BJ, UK', 'Van', '2025-01-05', '2025-01-05', 'completed', 430.00, 310.00, 'Mike Johnson', '2025-01-05 08:00:00', '2025-01-05 17:00:00'),
  ('LOAD-012', 'Manchester, M2 3BB, UK', 'Liverpool, L3 9PP, UK', 'Luton Van', '2025-01-08', '2025-01-08', 'completed', 310.00, 230.00, 'James Clark', '2025-01-08 09:30:00', '2025-01-08 15:00:00'),
  ('LOAD-013', 'Leeds, LS2 7EE, UK', 'York, YO1 7HZ, UK', 'Van', '2025-01-10', '2025-01-10', 'completed', 270.00, 200.00, 'Sarah Wilson', '2025-01-10 10:00:00', '2025-01-10 14:30:00'),
  
  -- Current/Recent bookings (December 2024)
  ('LOAD-014', 'London, E1 6AN, UK', 'Dover, CT16 1JA, UK', 'Long Wheel Base Van', '2024-12-13', NULL, 'in_transit', 480.00, 350.00, 'Mike Johnson', '2024-12-13 07:00:00', NOW()),
  ('LOAD-015', 'Coventry, CV1 1AA, UK', 'Leicester, LE1 1AA, UK', 'Van', '2024-12-14', NULL, 'confirmed', 290.00, 220.00, NULL, '2024-12-13 14:00:00', NOW()),
  ('LOAD-016', 'Reading, RG1 1AA, UK', 'Swindon, SN1 1AA, UK', 'Luton Van', '2024-12-15', NULL, 'pending', 320.00, 240.00, NULL, '2024-12-13 16:00:00', NOW()),
  
  -- High value deliveries
  ('LOAD-017', 'London, NW1 6XE, UK', 'Aberdeen, AB10 1AA, UK', 'Long Wheel Base Van', '2024-12-06', '2024-12-06', 'delivered', 850.00, 620.00, 'Mike Johnson', '2024-12-06 05:00:00', '2024-12-06 22:00:00'),
  ('LOAD-018', 'Cardiff, CF24 0DE, UK', 'Inverness, IV1 1AA, UK', 'Long Wheel Base Van', '2024-12-07', '2024-12-07', 'delivered', 920.00, 680.00, 'James Clark', '2024-12-07 04:30:00', '2024-12-07 23:00:00');

-- Insert sample invoices
INSERT INTO invoices (booking_id, invoice_number, amount, status, due_date, paid_date, notes, created_at, updated_at)
VALUES
  (1, 'INV-2024-001', 450.00, 'paid', '2024-12-15', '2024-12-14', 'Paid via bank transfer', '2024-12-01 18:30:00', '2024-12-14 10:00:00'),
  (2, 'INV-2024-002', 380.00, 'paid', '2024-12-16', '2024-12-15', 'Paid on time', '2024-12-02 18:00:00', '2024-12-15 11:00:00'),
  (3, 'INV-2024-003', 290.00, 'paid', '2024-12-17', '2024-12-16', NULL, '2024-12-03 14:30:00', '2024-12-16 09:30:00'),
  (4, 'INV-2024-004', 520.00, 'sent', '2024-12-18', NULL, 'Awaiting payment', '2024-12-04 16:30:00', NOW()),
  (5, 'INV-2024-005', 350.00, 'sent', '2024-12-19', NULL, NULL, '2024-12-05 15:30:00', NOW()),
  (11, 'INV-2025-001', 430.00, 'pending', '2025-01-19', NULL, NULL, '2025-01-05 17:30:00', NOW());

-- Insert sample feedback
INSERT INTO feedback (user_id, booking_id, rating, comment, feedback_type, created_at)
VALUES
  (2, 1, 5, 'Excellent service, delivered on time and in perfect condition!', 'booking', '2024-12-01 19:00:00'),
  (2, 4, 5, 'Professional driver, great communication throughout.', 'booking', '2024-12-04 17:00:00'),
  (1, 2, 4, 'Good service overall, minor delay but informed promptly.', 'booking', '2024-12-02 18:00:00'),
  (2, 17, 5, 'Long distance delivery handled perfectly.', 'booking', '2024-12-06 23:30:00'),
  (NULL, NULL, 5, 'Love the new platform interface, very user-friendly!', 'general', '2024-12-10 14:00:00');

-- Insert sample watchlist items
INSERT INTO watchlist (user_id, item_type, item_id, notes, created_at)
VALUES
  (1, 'booking', 15, 'Track this delivery closely', NOW()),
  (1, 'booking', 16, 'High priority customer', NOW()),
  (2, 'booking', 14, 'My current job', NOW());

-- Summary output
SELECT 'Seed data inserted successfully!' as message;
SELECT 
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM bookings) as bookings_count,
  (SELECT COUNT(*) FROM invoices) as invoices_count,
  (SELECT COUNT(*) FROM feedback) as feedback_count,
  (SELECT COUNT(*) FROM watchlist) as watchlist_count;
-- ⚠️  WARNING: FOR DEVELOPMENT/TESTING ONLY - DO NOT USE IN PRODUCTION
-- All passwords are 'password123' (bcrypt hashed with 10 rounds)
-- These accounts should be deleted or passwords changed before production deployment
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
