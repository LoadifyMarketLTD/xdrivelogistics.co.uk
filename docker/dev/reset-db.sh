#!/bin/bash
# Reset the database (drop and recreate schema)

echo "🔄 Resetting database..."

docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO xdrive;
GRANT ALL ON SCHEMA public TO public;
EOF

echo "📋 Applying schema..."
docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db < db/schema.sql

echo "🌱 Seeding data..."
docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db < db/seeds.sql

echo "✅ Database reset complete!"
