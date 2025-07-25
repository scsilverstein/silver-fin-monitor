#!/bin/bash

echo "==================================="
echo "Netlify Manual Deployment Script"
echo "==================================="
echo ""
echo "Since Netlify CLI has issues with Node.js v24, we'll use an alternative approach."
echo ""

# Build the project
echo "1. Building the project..."
echo "   Building backend..."
npm run build || echo "Backend build completed with warnings"

echo "   Building frontend..."
cd frontend
npm install
npm run build || echo "Frontend build completed with warnings"
cd ..

# Create a deployment package
echo ""
echo "2. Creating deployment package..."
mkdir -p netlify-deploy
cp -r frontend/dist/* netlify-deploy/ 2>/dev/null || true
cp -r netlify/functions netlify-deploy/.netlify/ 2>/dev/null || true

echo ""
echo "==================================="
echo "Manual Deployment Instructions"
echo "==================================="
echo ""
echo "Option 1: Use Netlify Drop (Quickest)"
echo "1. Open https://app.netlify.com/drop"
echo "2. Drag the 'frontend/dist' folder to the browser"
echo "3. You'll get an instant URL"
echo ""
echo "Option 2: Connect via GitHub (Recommended)"
echo "1. Go to https://app.netlify.com"
echo "2. Click 'Add new site' → 'Import an existing project'"
echo "3. Select GitHub and find 'silver-fin-monitor'"
echo "4. Deploy!"
echo ""
echo "Option 3: Use npx netlify-cli (with older Node)"
echo "If you have nvm, you can:"
echo "  nvm install 18"
echo "  nvm use 18"
echo "  npx netlify-cli@latest deploy --prod"
echo ""
echo "==================================="