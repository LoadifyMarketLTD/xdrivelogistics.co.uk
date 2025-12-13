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
