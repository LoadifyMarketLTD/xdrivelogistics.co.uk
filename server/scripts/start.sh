#!/bin/bash
# Convenience script to start the backend server

set -e

echo "🚀 Starting XDrive Logistics Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  Warning: .env file not found. Copying from .env.example..."
  cp .env.example .env
  echo "✓ Created .env file. Please update it with your configuration."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the server
echo "✓ Starting server..."
npm start
