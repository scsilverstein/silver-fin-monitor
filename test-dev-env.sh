#!/bin/bash

echo "🧪 Testing Silver Fin Monitor Development Environment"
echo "=================================================="
echo ""

# Test 1: Check if Netlify function is built
echo "1. Checking Netlify function build..."
if [ -f "netlify/functions/api.js" ]; then
    echo "✅ Netlify function is built"
    echo "   Size: $(du -h netlify/functions/api.js | cut -f1)"
else
    echo "❌ Netlify function not found. Building..."
    npm run build:function
fi
echo ""

# Test 2: Check if frontend can build
echo "2. Testing frontend build..."
cd frontend
if npm run build > /dev/null 2>&1; then
    echo "✅ Frontend builds successfully"
else
    echo "❌ Frontend build failed"
fi
cd ..
echo ""

# Test 3: Check ports availability
echo "3. Checking port availability..."
for port in 5173 8888; do
    if lsof -i :$port > /dev/null 2>&1; then
        echo "⚠️  Port $port is in use"
        lsof -i :$port | grep LISTEN
    else
        echo "✅ Port $port is available"
    fi
done
echo ""

# Test 4: Check environment variables
echo "4. Checking required environment variables..."
required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_KEY" "OPENAI_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var is not set"
    else
        echo "✅ $var is set"
    fi
done
echo ""

echo "=================================================="
echo "To start the development server with auto-rebuild:"
echo "  npm run dev:auto"
echo ""
echo "Or use the standard Netlify dev:"
echo "  netlify dev --port 8888"
echo "=================================================="