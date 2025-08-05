#!/bin/bash

echo "🧪 Testing Analysis Endpoints"
echo "============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local auth=$4
    
    echo -e "${YELLOW}Testing:${NC} $method $url"
    
    if [ "$method" = "GET" ]; then
        if [ -n "$auth" ]; then
            response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $auth" "$url")
        else
            response=$(curl -s -w "\n%{http_code}" "$url")
        fi
    else
        if [ -n "$auth" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $auth" -d "$data" "$url")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url")
        fi
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n 1)
    # Extract response body (all except last line)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
        echo -e "${GREEN}✅ Success:${NC} $status_code"
    elif [ "$status_code" = "401" ]; then
        echo -e "${YELLOW}⚠️  Unauthorized:${NC} $status_code (needs auth)"
    else
        echo -e "${RED}❌ Failed:${NC} $status_code"
    fi
    
    # Show response body (first 100 chars)
    if [ -n "$body" ]; then
        echo "Response: ${body:0:100}..."
    fi
    echo ""
}

# First, try to login to get a token
echo "1️⃣ Attempting login..."
login_response=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"email":"demo@example.com","password":"demo"}' \
    "http://localhost:8888/api/v1/auth/login")

# Try to extract token
token=$(echo "$login_response" | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -n "$token" ]; then
    echo -e "${GREEN}✅ Login successful${NC}"
    echo "Token: ${token:0:20}..."
else
    echo -e "${YELLOW}⚠️  Login failed, testing without auth${NC}"
fi
echo ""

echo "2️⃣ Testing Analysis Endpoints"
echo "----------------------------"

# Test GET /analysis
test_endpoint "GET" "http://localhost:8888/api/v1/analysis" "" "$token"

# Test GET /analysis/latest  
test_endpoint "GET" "http://localhost:8888/api/v1/analysis/latest" "" "$token"

# Test POST /analysis/trigger
test_endpoint "POST" "http://localhost:8888/api/v1/analysis/trigger" \
    '{"date":"2025-01-01","force":false}' "$token"

# Test with direct Netlify function paths (for debugging)
echo ""
echo "3️⃣ Testing Direct Netlify Function Paths (Debug)"
echo "----------------------------------------------"

test_endpoint "GET" "http://localhost:8888/.netlify/functions/api/v1/analysis" "" "$token"
test_endpoint "POST" "http://localhost:8888/.netlify/functions/api/v1/analysis/trigger" \
    '{"date":"2025-01-01","force":false}' "$token"

echo ""
echo "✅ Testing complete!"