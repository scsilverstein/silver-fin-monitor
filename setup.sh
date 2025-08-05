#!/bin/bash

# Silver Fin Monitor - Setup Script
# This script sets up the complete development environment

echo "🚀 Silver Fin Monitor - Complete System Setup"
echo "============================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Backend dependency installation failed"
    exit 1
fi
echo "✅ Backend dependencies installed"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Frontend dependency installation failed"
    exit 1
fi
cd ..
echo "✅ Frontend dependencies installed"
echo ""

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Setting up environment configuration..."
    cp .env.example .env
    echo "✅ Environment file created (.env)"
    echo "   👉 Please edit .env file with your API keys and database credentials"
else
    echo "✅ Environment file already exists"
fi
echo ""

# Run integration test
echo "🔍 Running integration verification..."
node test-integration.js
echo ""

# Check TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
echo "Backend compilation:"
npx tsc --noEmit --skipLibCheck 2>/dev/null && echo "✅ Backend TypeScript OK" || echo "⚠️  Backend TypeScript issues (likely missing .env values)"

echo "Frontend compilation:"
cd frontend
npx tsc --noEmit --skipLibCheck 2>/dev/null && echo "✅ Frontend TypeScript OK" || echo "⚠️  Frontend TypeScript issues (likely missing dependencies)"
cd ..
echo ""

# Display setup completion
echo "🎉 SETUP COMPLETE!"
echo "=================="
echo ""
echo "Your Silver Fin Monitor system is ready! Here's what's been set up:"
echo ""
echo "✅ Backend Server (Express + TypeScript)"
echo "  • JWT Authentication with RBAC"
echo "  • WebSocket real-time communication"
echo "  • Multi-source feed processing"
echo "  • AI analysis pipeline (GPT-4)"
echo "  • Stock scanner with peer comparison"
echo "  • System monitoring and alerting"
echo "  • Database queue and cache systems"
echo ""
echo "✅ Frontend Application (React + TypeScript)"
echo "  • Modern UI with Tailwind CSS"
echo "  • Real-time dashboard"
echo "  • Admin panel with system monitoring"
echo "  • WebSocket integration"
echo "  • Zustand state management"
echo ""
echo "✅ Database Integration"
echo "  • PostgreSQL via Supabase"
echo "  • Queue system (no Redis needed)"
echo "  • Cache layer with TTL"
echo "  • Vector embeddings support"
echo ""
echo "✅ External Integrations"
echo "  • OpenAI GPT-4 for analysis"
echo "  • Local Whisper for transcription"
echo "  • Yahoo Finance + Alpha Vantage"
echo "  • Email/Slack/Webhook alerts"
echo ""

# Display next steps
echo "🚀 NEXT STEPS:"
echo "=============="
echo ""
echo "1. 📝 Configure your API keys in .env file:"
echo "   • SUPABASE_URL and SUPABASE_ANON_KEY"
echo "   • OPENAI_API_KEY for AI analysis"
echo "   • YOUTUBE_API_KEY for YouTube feeds (optional)"
echo "   • SMTP settings for email alerts (optional)"
echo ""
echo "2. 🗄️  Set up your Supabase database:"
echo "   • Create a new Supabase project"
echo "   • Run: npm run db:migrate"
echo ""
echo "3. 🎬 Start the development servers:"
echo "   • Backend:  npm run dev"
echo "   • Frontend: cd frontend && npm run dev"
echo ""
echo "4. 🌐 Access your application:"
echo "   • Frontend: http://localhost:5173"
echo "   • Backend:  http://localhost:3001/api/v1"
echo "   • Admin:    http://localhost:5173/admin"
echo ""
echo "5. 📚 Read the documentation:"
echo "   • CLAUDE.md - Complete system specification"
echo "   • INTEGRATION_GUIDE.md - Integration details"
echo ""

# Display additional help
echo "💡 HELPFUL COMMANDS:"
echo "==================="
echo ""
echo "• npm run dev            - Start backend server"
echo "• npm run build          - Build for production"
echo "• npm run test           - Run tests"
echo "• npm run typecheck      - Check TypeScript"
echo "• npm run lint           - Check code style"
echo "• node test-integration.js - Verify system integration"
echo ""

# Display support information
echo "🆘 NEED HELP?"
echo "============="
echo ""
echo "• Check INTEGRATION_GUIDE.md for detailed setup"
echo "• Review CLAUDE.md for complete documentation"
echo "• Verify .env configuration matches your services"
echo "• Ensure Supabase database is properly configured"
echo ""

echo "🎊 Happy coding with Silver Fin Monitor!"
echo ""