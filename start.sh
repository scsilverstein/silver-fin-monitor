#!/bin/bash

# Silver Fin Monitor Startup Script

echo "🚀 Starting Silver Fin Monitor..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it:"
    echo "cp .env.example .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Function to check if port is in use
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
    return $?
}

# Kill processes on ports if they're in use
if check_port 3001; then
    echo "⚠️  Port 3001 is in use, killing process..."
    kill -9 $(lsof -ti:3001) 2>/dev/null
fi

if check_port 5173; then
    echo "⚠️  Port 5173 is in use, killing process..."
    kill -9 $(lsof -ti:5173) 2>/dev/null
fi

# Start backend
echo "🔧 Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Start frontend
echo "🎨 Starting frontend..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Function to handle shutdown
shutdown() {
    echo -e "\n🛑 Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Trap SIGINT and SIGTERM
trap shutdown SIGINT SIGTERM

echo -e "\n✅ Silver Fin Monitor is running!"
echo "📊 Backend: http://localhost:3001"
echo "🌐 Frontend: http://localhost:5173"
echo "📚 API Docs: http://localhost:3001/api-docs"
echo -e "\nPress Ctrl+C to stop all services.\n"

# Wait for processes
wait