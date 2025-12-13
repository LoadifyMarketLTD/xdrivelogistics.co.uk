-- XDrive Logistics Seed Data
-- Demo data for testing and development

-- Insert demo users
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
