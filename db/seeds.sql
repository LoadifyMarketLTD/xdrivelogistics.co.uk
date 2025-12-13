-- XDrive Logistics Seed Data
-- Demo data for testing and development

-- Insert demo users
INSERT INTO users (account_type, email, password_hash, status, created_at) VALUES
  ('shipper', 'shipper@xdrive.test', '$2b$10$XqGkz8Z9J1q0J9J9J9J9Ju7X8J9J9J9J9J9J9J9J9J9J9J9J9J9J9', 'active', NOW()),
  ('driver', 'driver@xdrive.test', '$2b$10$XqGkz8Z9J1q0J9J9J9J9Ju7X8J9J9J9J9J9J9J9J9J9J9J9J9J9J9', 'active', NOW()),
  ('driver', 'john.driver@xdrive.test', '$2b$10$XqGkz8Z9J1q0J9J9J9J9Ju7X8J9J9J9J9J9J9J9J9J9J9J9J9J9J9', 'active', NOW());
-- Password for all demo accounts: password123

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
