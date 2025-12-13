#!/bin/bash
# Seed the database with sample data

echo "🌱 Seeding database..."

docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db < db/seeds.sql

echo "✅ Database seeded successfully!"
