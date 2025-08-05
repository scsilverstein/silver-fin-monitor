#!/bin/bash

echo "Testing content API with timeframe filter..."
echo ""
echo "Request: GET /api/v1/content?limit=10&timeframe=1d"
echo ""

# You might need to add your auth token here
curl -s "http://localhost:8888/api/v1/content?limit=10&timeframe=1d" \
  -H "Authorization: Bearer demo-token" \
  | jq '.meta, (.data | length)'