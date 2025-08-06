#!/bin/bash
set -e

echo "Building Netlify functions..."
npx esbuild netlify/functions/api.ts --bundle --platform=node --outfile=netlify/functions/api.js

echo "Installing frontend dependencies..."
cd frontend
rm -rf node_modules
npm install --include=dev

echo "Checking installed packages..."
ls -la node_modules/@vitejs/ || echo "@vitejs not found"

echo "Building frontend..."
npm run build

echo "Build complete!"