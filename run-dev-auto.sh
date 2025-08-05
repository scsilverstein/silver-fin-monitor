#!/bin/bash

echo "🚀 Starting Silver Fin Monitor with Auto-Rebuild"
echo "================================================"
echo ""
echo "This will run:"
echo "1. TypeScript function compilation in watch mode"
echo "2. Netlify dev server"
echo "3. Frontend Vite dev server"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================================"
echo ""

# Build the function first
echo "📦 Building Netlify function..."
npm run build:function

# Start all services concurrently
echo ""
echo "🌐 Starting development servers..."
npx concurrently -n "FUNCTION,NETLIFY" -c "blue,green" \
  "npx esbuild netlify/functions/api.ts --bundle --platform=node --outfile=netlify/functions/api.js --watch --external:aws-sdk" \
  "netlify dev --port 8888"