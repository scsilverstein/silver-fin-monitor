#!/bin/bash

echo "Starting Netlify deployment with Node 18..."
echo "========================================="

# Switch to Node 18
source ~/.nvm/nvm.sh
nvm use 18

echo "Node version: $(node --version)"
echo ""

# Create a new Netlify site
echo "Creating new Netlify site..."
netlify sites:create --name silver-fin-monitor-$(date +%s) <<EOF
silversoftwerks's team
EOF

echo ""
echo "Linking to GitHub repository..."
netlify link --git-remote-name origin

echo ""
echo "Deploying to production..."
netlify deploy --dir frontend/dist --prod

echo ""
echo "========================================="
echo "Deployment complete!"
echo ""
echo "To add environment variables, run:"
echo "netlify env:set SUPABASE_URL 'https://pnjtzwqieqcrchhjouaz.supabase.co'"
echo "netlify env:set SUPABASE_SERVICE_KEY 'your_service_key'"
echo "netlify env:set OPENAI_API_KEY 'your_openai_key'"
echo "netlify env:set JWT_SECRET 'your_jwt_secret'"
echo ""
echo "Then redeploy with: netlify deploy --prod"