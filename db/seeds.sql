-- XDrive Logistics Seed Data
-- Sample data for demonstration

-- Clear existing data (for re-seeding)
TRUNCATE TABLE feedback, watchlist, invoices, bookings, users RESTART IDENTITY CASCADE;

-- Insert sample users
INSERT INTO users (account_type, email, password_hash, status, created_at) VALUES
('shipper', 'shipper@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpSzUaVu2', 'active', NOW() - INTERVAL '30 days'),
('driver', 'driver@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpSzUaVu2', 'active', NOW() - INTERVAL '25 days'),
('shipper', 'shipper2@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIpSzUaVu2', 'active', NOW() - INTERVAL '20 days');
-- Password for all demo users: 'password123'

-- Insert sample bookings with realistic data
INSERT INTO bookings (load_id, from_address, to_address, vehicle_type, pickup_window_start, pickup_window_end, delivery_instruction, subcontractor, price, subcontract_cost, status, completed_by, created_at, updated_at) VALUES
('LD-2025-001', 'London, Heathrow Airport, Terminal 5', 'Manchester, City Centre, Piccadilly', 'Large Van', '2025-01-15 08:00:00', '2025-01-15 10:00:00', 'Fragile cargo - handle with care', 'Swift Logistics Ltd', 450.00, 320.00, 'Delivered', 'John Smith', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
('LD-2025-002', 'Birmingham, New Street Station', 'Edinburgh, Waverley Station', 'Luton Van', '2025-01-16 09:00:00', '2025-01-16 11:00:00', 'Temperature controlled required', 'Northern Express', 580.00, 410.00, 'Delivered', 'Sarah Johnson', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
('LD-2025-003', 'Bristol, Temple Meads', 'Cardiff, City Centre', 'Small Van', '2025-01-17 14:00:00', '2025-01-17 16:00:00', 'Contact recipient before delivery', NULL, 280.00, 0.00, 'Delivered', 'Mike Davis', NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
('LD-2025-004', 'Leeds, Bradford Airport', 'Newcastle, Central Station', 'Large Van', '2025-01-18 07:00:00', '2025-01-18 09:00:00', 'Urgent delivery - time critical', 'Fast Track Services', 520.00, 380.00, 'Delivered', 'Emma Wilson', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
('LD-2025-005', 'Southampton, Port', 'London, Canary Wharf', 'Luton Van', '2025-01-19 10:00:00', '2025-01-19 12:00:00', 'Heavy items - tail lift required', 'London Couriers', 390.00, 280.00, 'Delivered', 'David Brown', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
('LD-2025-006', 'Glasgow, Airport', 'Aberdeen, City Centre', 'Small Van', '2025-01-20 13:00:00', '2025-01-20 15:00:00', 'Multiple drop points - 3 stops', NULL, 340.00, 0.00, 'Delivered', 'Lisa Anderson', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('LD-2025-007', 'Liverpool, Docks', 'Sheffield, Station', 'Large Van', '2025-01-21 08:30:00', '2025-01-21 10:30:00', 'Documents for signature required', 'Express Deliveries UK', 470.00, 350.00, 'Delivered', 'Tom Harris', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
('LD-2025-008', 'Oxford, City Centre', 'Cambridge, University', 'Small Van', '2025-01-22 11:00:00', '2025-01-22 13:00:00', 'Academic materials - handle with care', NULL, 220.00, 0.00, 'Delivered', 'Rachel Green', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
('LD-2025-009', 'Nottingham, Station', 'Derby, City Centre', 'Luton Van', '2025-01-23 09:30:00', '2025-01-23 11:30:00', 'Office furniture - assembly may be needed', 'Midlands Transport', 350.00, 260.00, 'Delivered', 'James Taylor', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
('LD-2025-010', 'Plymouth, Port', 'Exeter, Station', 'Large Van', '2025-01-24 07:30:00', '2025-01-24 09:30:00', 'Medical supplies - priority delivery', 'Southwest Couriers', 410.00, 300.00, 'Delivered', 'Sophie Martin', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
('LD-2025-011', 'Brighton, Marina', 'Portsmouth, Harbour', 'Small Van', '2025-01-25 15:00:00', '2025-01-25 17:00:00', 'Coastal route - avoid M25', NULL, 265.00, 0.00, 'Delivered', 'Oliver White', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
('LD-2025-012', 'York, Station', 'Hull, Docks', 'Luton Van', '2025-01-26 08:00:00', '2025-01-26 10:00:00', 'Industrial equipment - forklift needed', 'Yorkshire Logistics', 495.00, 370.00, 'Delivered', 'Charlotte Lee', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
('LD-2025-013', 'Chester, City Centre', 'Manchester, Trafford Park', 'Large Van', '2025-01-27 12:00:00', '2025-01-27 14:00:00', 'Retail stock - scan all items', 'North West Freight', 385.00, 280.00, 'Delivered', 'Harry Clark', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
('LD-2025-014', 'Reading, Station', 'Swindon, Business Park', 'Small Van', '2025-01-28 10:00:00', '2025-01-28 12:00:00', 'IT equipment - keep dry', NULL, 195.00, 0.00, 'Delivered', 'Emily Roberts', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
('LD-2025-015', 'Coventry, Station', 'Leicester, City Centre', 'Luton Van', '2025-01-29 14:30:00', '2025-01-29 16:30:00', 'Fashion items - hanging rails needed', 'Midlands Express', 310.00, 230.00, 'Delivered', 'George Walker', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Insert sample invoices
INSERT INTO invoices (booking_id, invoice_number, amount, due_date, status, notes, created_at) VALUES
(1, 'INV-2025-001', 450.00, '2025-02-15', 'paid', 'Paid via bank transfer', NOW() - INTERVAL '10 days'),
(2, 'INV-2025-002', 580.00, '2025-02-16', 'paid', 'Paid via credit card', NOW() - INTERVAL '9 days'),
(3, 'INV-2025-003', 280.00, '2025-02-17', 'pending', NULL, NOW() - INTERVAL '8 days'),
(4, 'INV-2025-004', 520.00, '2025-02-18', 'paid', 'Paid via PayPal', NOW() - INTERVAL '7 days'),
(5, 'INV-2025-005', 390.00, '2025-02-19', 'pending', NULL, NOW() - INTERVAL '6 days');

-- Insert sample feedback
INSERT INTO feedback (user_id, booking_id, rating, comment, created_at) VALUES
(1, 1, 5, 'Excellent service, very professional driver', NOW() - INTERVAL '10 days'),
(1, 2, 4, 'Good service, minor delay but communicated well', NOW() - INTERVAL '9 days'),
(2, 3, 5, 'Perfect delivery, exactly on time', NOW() - INTERVAL '8 days'),
(1, 4, 5, 'Outstanding service, highly recommend', NOW() - INTERVAL '7 days'),
(3, 5, 4, 'Good experience overall', NOW() - INTERVAL '6 days');

-- Insert sample watchlist entries
INSERT INTO watchlist (user_id, booking_id, notes, created_at) VALUES
(1, 3, 'Interested in similar routes', NOW() - INTERVAL '5 days'),
(2, 7, 'Preferred customer', NOW() - INTERVAL '4 days'),
(1, 10, 'Medical supplies - priority client', NOW() - INTERVAL '3 days');

-- Display summary
SELECT 'Seed data loaded successfully!' as message;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as booking_count FROM bookings;
SELECT COUNT(*) as invoice_count FROM invoices;
SELECT COUNT(*) as feedback_count FROM feedback;
SELECT COUNT(*) as watchlist_count FROM watchlist;
-- Demo data for testing and development

-- Insert demo users (password for all: "password123")
-- bcrypt hash for "password123" with 10 rounds: $2b$10$wI5lBmm/zgbDkoOZh2mise8IXrbuNI.CYC3KPa1Dy4TVyFsqGVRYW
INSERT INTO users (account_type, email, password_hash, status, created_at, updated_at) VALUES
('shipper', 'shipper@xdrivelogistics.co.uk', '$2b$10$wI5lBmm/zgbDkoOZh2mise8IXrbuNI.CYC3KPa1Dy4TVyFsqGVRYW', 'active', NOW(), NOW()),
('driver', 'driver@xdrivelogistics.co.uk', '$2b$10$wI5lBmm/zgbDkoOZh2mise8IXrbuNI.CYC3KPa1Dy4TVyFsqGVRYW', 'active', NOW(), NOW()),
('driver', 'ion@xdrivelogistics.co.uk', '$2b$10$wI5lBmm/zgbDkoOZh2mise8IXrbuNI.CYC3KPa1Dy4TVyFsqGVRYW', 'active', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert demo bookings based on user-provided data
INSERT INTO bookings (
  load_id,
  customer_name,
  from_address,
  to_address,
  vehicle_type,
  pickup_time,
  delivery_time,
  status,
  price,
  subcontract_cost,
  completed_by,
  your_ref,
  notes,
  created_at,
  updated_at
) VALUES
-- Load 1: Delivered by Ion
(
  '77576338',
  'Nordfab Ducting Ltd',
  'Nordfab Ducting Ltd, Limewood Approach, Seacroft, LS14 1NG',
  'ASAP Cargo, Unit 3, ERGO PARK, CW10 0GT',
  'LWB up to 4m',
  '2025-12-12 11:00:00+00',
  '2025-12-12 14:18:00+00',
  'delivered',
  850.00,
  620.00,
  'Ion',
  '26085',
  'Delivery completed successfully',
  '2025-12-10 09:00:00+00',
  '2025-12-12 14:18:00+00'
),
-- Load 2: Recent delivery
(
  '77576339',
  'ABC Manufacturing',
  'ABC Manufacturing, Industrial Estate, Manchester, M11 2AA',
  'Distribution Centre, Park Lane, Birmingham, B12 3CD',
  'SWB up to 3m',
  '2025-12-11 08:00:00+00',
  '2025-12-11 13:30:00+00',
  'delivered',
  680.00,
  480.00,
  'Ion',
  '26086',
  NULL,
  '2025-12-09 10:00:00+00',
  '2025-12-11 13:30:00+00'
),
-- Load 3: In transit
(
  '77576340',
  'Global Supplies Ltd',
  'Global Supplies Ltd, Warehouse 5, London, E14 5AB',
  'Northern Depot, Station Road, Leeds, LS1 4DY',
  'LWB up to 4m',
  '2025-12-13 07:00:00+00',
  '2025-12-13 17:00:00+00',
  'in_transit',
  920.00,
  700.00,
  'Ion',
  '26087',
  'Priority delivery',
  '2025-12-11 14:00:00+00',
  '2025-12-13 07:00:00+00'
),
-- Load 4: Completed with higher margin
(
  '77576341',
  'TechParts Distribution',
  'TechParts Distribution, Unit 12, Bristol, BS2 8QA',
  'RetailHub, Commerce Park, Cardiff, CF10 4GA',
  'Luton Van',
  '2025-12-10 10:00:00+00',
  '2025-12-10 15:45:00+00',
  'delivered',
  1200.00,
  850.00,
  'Ion',
  '26088',
  'Fragile items - handled with care',
  '2025-12-08 11:00:00+00',
  '2025-12-10 15:45:00+00'
),
-- Load 5: Subcontracted
(
  '77576342',
  'HomeGoods Express',
  'HomeGoods Express, Retail Park, Sheffield, S9 2YL',
  'Customer Residence, Oak Street, Nottingham, NG1 3AL',
  'SWB up to 3m',
  '2025-12-09 09:30:00+00',
  '2025-12-09 14:00:00+00',
  'delivered',
  550.00,
  380.00,
  'Third Party Logistics',
  '26089',
  'Subcontracted to external carrier',
  '2025-12-07 15:00:00+00',
  '2025-12-09 14:00:00+00'
),
-- Load 6: Recent high-value delivery
(
  '77576343',
  'Premium Electronics',
  'Premium Electronics, Tech Park, Cambridge, CB4 0WS',
  'Exhibition Centre, Grand Ave, Oxford, OX1 2JD',
  'LWB up to 4m',
  '2025-12-12 06:00:00+00',
  '2025-12-12 11:30:00+00',
  'delivered',
  1450.00,
  980.00,
  'Ion',
  '26090',
  'High-value equipment - insurance verified',
  '2025-12-10 16:00:00+00',
  '2025-12-12 11:30:00+00'
),
-- Load 7: Allocated for tomorrow
(
  '77576344',
  'Fresh Foods Ltd',
  'Fresh Foods Ltd, Distribution Hub, Liverpool, L3 8HL',
  'Supermarket Chain, Market Square, Chester, CH1 2AN',
  'Refrigerated Van',
  '2025-12-14 05:00:00+00',
  '2025-12-14 09:00:00+00',
  'allocated',
  780.00,
  520.00,
  'Ion',
  '26091',
  'Temperature-controlled delivery',
  '2025-12-12 13:00:00+00',
  '2025-12-12 13:00:00+00'
),
-- Load 8: Completed last week
(
  '77576345',
  'BuildMaster Supplies',
  'BuildMaster Supplies, Yard 7, Newcastle, NE1 4ST',
  'Construction Site, Project Way, Durham, DH1 1TA',
  'Luton Van',
  '2025-12-05 08:00:00+00',
  '2025-12-05 12:30:00+00',
  'delivered',
  650.00,
  450.00,
  'Ion',
  '26092',
  NULL,
  '2025-12-03 09:00:00+00',
  '2025-12-05 12:30:00+00'
),
-- Load 9: Recent medium margin
(
  '77576346',
  'Office Furniture Direct',
  'Office Furniture Direct, Warehouse B, Glasgow, G2 3BZ',
  'Corporate HQ, Business District, Edinburgh, EH2 4BB',
  'LWB up to 4m',
  '2025-12-11 10:00:00+00',
  '2025-12-11 16:00:00+00',
  'delivered',
  890.00,
  620.00,
  'Ion',
  '26093',
  'Assembly required on-site',
  '2025-12-09 14:00:00+00',
  '2025-12-11 16:00:00+00'
),
-- Load 10: Pending confirmation
(
  '77576347',
  'Garden Supplies Co',
  'Garden Supplies Co, Nursery Road, Reading, RG1 3AT',
  'Landscaping Project, Green Lane, Swindon, SN1 2PQ',
  'SWB up to 3m',
  '2025-12-15 09:00:00+00',
  '2025-12-15 14:00:00+00',
  'pending',
  720.00,
  500.00,
  NULL,
  '26094',
  'Awaiting final confirmation from customer',
  '2025-12-12 11:00:00+00',
  '2025-12-12 11:00:00+00'
)
ON CONFLICT (load_id) DO NOTHING;

-- Insert demo invoices for some of the completed bookings
INSERT INTO invoices (booking_id, amount, status, due_date, notes, created_at) VALUES
(1, 850.00, 'paid', '2025-12-26', 'Paid in full', NOW()),
(2, 680.00, 'pending', '2025-12-25', NULL, NOW()),
(4, 1200.00, 'awaiting_payment', '2025-12-24', 'Payment processing', NOW()),
(5, 550.00, 'paid', '2025-12-23', 'Paid via bank transfer', NOW()),
(6, 1450.00, 'pending', '2026-01-11', 'Net 30 terms', NOW())
ON CONFLICT DO NOTHING;

-- Insert some demo feedback
INSERT INTO feedback (booking_id, from_user_id, to_user_id, payment_rating, delivery_rating, comments, created_at) VALUES
(1, 1, 3, 'definitely', 'definitely', 'Excellent service, on time delivery', NOW() - INTERVAL '1 day'),
(2, 1, 3, 'definitely', 'definitely', 'Professional driver, great communication', NOW() - INTERVAL '2 days'),
(4, 1, 3, 'maybe', 'definitely', 'Good delivery, payment processing slightly delayed', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- Output summary
DO $$
DECLARE
  user_count INTEGER;
  booking_count INTEGER;
  invoice_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO booking_count FROM bookings;
  SELECT COUNT(*) INTO invoice_count FROM invoices;
  
  RAISE NOTICE '✓ Seed data loaded successfully';
  RAISE NOTICE '  - Users: %', user_count;
  RAISE NOTICE '  - Bookings: %', booking_count;
  RAISE NOTICE '  - Invoices: %', invoice_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Demo login credentials:';
  RAISE NOTICE '  Email: shipper@xdrivelogistics.co.uk / Password: password123';
  RAISE NOTICE '  Email: driver@xdrivelogistics.co.uk / Password: password123';
  RAISE NOTICE '  Email: ion@xdrivelogistics.co.uk / Password: password123';
END $$;
