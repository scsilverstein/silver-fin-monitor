#!/bin/bash

echo "🎯 Testing Analysis Trigger Endpoint Fix"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test the critical endpoint that was failing
echo "1️⃣ Testing POST /api/v1/analysis/trigger (the failing endpoint)"
echo ""

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-01-01","force":false}' \
  http://localhost:8888/api/v1/analysis/trigger)

# Extract status code
status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
# Extract body
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status Code: $status"
echo "Response Body: $body"
echo ""

if [ "$status" = "404" ]; then
    echo -e "${RED}❌ FAILED: Endpoint still returning 404 - Not Fixed${NC}"
    echo ""
    echo "The endpoint is still not being served. The issue persists."
elif [ "$status" = "401" ]; then
    echo -e "${GREEN}✅ SUCCESS: Endpoint is being served (401 = needs auth)${NC}"
    echo ""
    echo "The endpoint is now being served! It's asking for authentication, which means it's working."
elif [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo -e "${GREEN}✅ SUCCESS: Endpoint is working perfectly${NC}"
    echo ""
    echo "The endpoint is fully functional!"
else
    echo -e "${YELLOW}⚠️  Unexpected status code: $status${NC}"
    echo ""
    echo "The endpoint is being served but returning an unexpected status."
fi

echo ""
echo "2️⃣ Testing GET /api/v1/analysis/trigger (should return 405)"
echo ""

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  http://localhost:8888/api/v1/analysis/trigger)

status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS/d')

echo "Status Code: $status"
echo "Response Body: $body"
echo ""

if [ "$status" = "405" ]; then
    echo -e "${GREEN}✅ SUCCESS: GET correctly returns 405 Method Not Allowed${NC}"
elif [ "$status" = "404" ]; then
    echo -e "${RED}❌ FAILED: Endpoint still returning 404${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected status code: $status${NC}"
fi

echo ""
echo "Test complete!"