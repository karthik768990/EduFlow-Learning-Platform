#!/bin/bash

# EduFlow Production Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 EduFlow Production Deployment"
echo "================================="

# Check for required environment variables
if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "❌ Error: VITE_SUPABASE_URL is not set"
    echo "Please set it: export VITE_SUPABASE_URL=https://your-project.supabase.co"
    exit 1
fi

if [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    echo "❌ Error: VITE_SUPABASE_PUBLISHABLE_KEY is not set"
    echo "Please set it: export VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key"
    exit 1
fi

echo "✅ Environment variables validated"

# Build and deploy
echo "🔨 Building Docker image..."
docker-compose build --no-cache

echo "🚀 Starting containers..."
docker-compose up -d

echo "⏳ Waiting for health check..."
sleep 10

# Check health
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    echo "✅ Deployment successful!"
    echo "🌐 App is running at: http://localhost:3000"
else
    echo "❌ Health check failed"
    docker-compose logs
    exit 1
fi
