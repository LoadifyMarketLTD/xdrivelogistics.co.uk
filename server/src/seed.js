/**
 * Database seeding script
 * Cross-platform Node.js script to load seed data
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function seedDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read seed file
    const seedPath = path.join(__dirname, '../../db/seeds.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    // Execute seed SQL
    await client.query(seedSQL);
    
    console.log('✅ Database seeded successfully!');
    
    // Verify counts
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM bookings) as bookings_count,
        (SELECT COUNT(*) FROM invoices) as invoices_count,
        (SELECT COUNT(*) FROM feedback) as feedback_count,
        (SELECT COUNT(*) FROM watchlist) as watchlist_count
    `);
    
    console.log('Counts:', result.rows[0]);
    
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedDatabase();
