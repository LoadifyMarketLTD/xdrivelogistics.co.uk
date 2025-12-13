-- XDrive Logistics Seed Data
-- Demo data for testing and development

-- Insert demo users (password for all: "password123")
-- bcrypt hash for "password123" with 10 rounds: $2b$10$rKxN0YSqZz.PVLqF5xmTx.dBKQYFw3YI0.PxZn4kqYvQ0M7l4iqA6
INSERT INTO users (account_type, email, password_hash, status, created_at, updated_at) VALUES
('shipper', 'shipper@xdrivelogistics.co.uk', '$2b$10$rKxN0YSqZz.PVLqF5xmTx.dBKQYFw3YI0.PxZn4kqYvQ0M7l4iqA6', 'active', NOW(), NOW()),
('driver', 'driver@xdrivelogistics.co.uk', '$2b$10$rKxN0YSqZz.PVLqF5xmTx.dBKQYFw3YI0.PxZn4kqYvQ0M7l4iqA6', 'active', NOW(), NOW()),
('driver', 'ion@xdrivelogistics.co.uk', '$2b$10$rKxN0YSqZz.PVLqF5xmTx.dBKQYFw3YI0.PxZn4kqYvQ0M7l4iqA6', 'active', NOW(), NOW())
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
