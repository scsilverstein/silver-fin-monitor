#!/bin/bash

# Run Silver Fin Monitor Application

echo "Starting Silver Fin Monitor..."
echo "==============================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up trap to cleanup on ctrl+c
trap cleanup INT TERM

# Start backend
echo ""
echo "Starting backend server..."
cd /Users/scott/silver-fin-mon-V2
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start frontend
echo ""
echo "Starting frontend..."
cd /Users/scott/silver-fin-mon-V2/frontend
npm run dev &
FRONTEND_PID=$!

# Wait a bit for everything to start
sleep 3

echo ""
echo "==============================="
echo "Silver Fin Monitor is running!"
echo "==============================="
echo ""
echo "Backend:  http://localhost:3001/api/v1"
echo "Frontend: http://localhost:5176"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait