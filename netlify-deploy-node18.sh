#!/bin/bash

# Ensure we're using Node 18
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

echo "Using Node.js version: $(node --version)"
echo ""

# Now run Netlify commands
echo "Setting up Netlify deployment..."

# Initialize Netlify in the project
netlify init --manual

echo ""
echo "Deployment script ready. The Netlify CLI should now work with Node 18."