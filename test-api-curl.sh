#!/bin/bash

echo "Testing Stock Screener API..."
echo "=============================="

echo -e "\n1. Testing /api/v1/stocks/screener endpoint:"
curl -s http://localhost:3001/api/v1/stocks/screener | python3 -m json.tool | head -50

echo -e "\n\n2. Testing /api/v1/stocks/sectors endpoint:"
curl -s http://localhost:3001/api/v1/stocks/sectors | python3 -m json.tool

echo -e "\n\n3. Testing with filters (Technology sector, P/E < 20):"
curl -s "http://localhost:3001/api/v1/stocks/screener?sector=Technology&maxPE=20" | python3 -m json.tool | head -30

echo -e "\n\nDone!"