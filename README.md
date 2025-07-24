# Silver Fin Monitor

A production-ready market intelligence platform that automatically aggregates, analyzes, and synthesizes financial information from diverse sources using advanced AI.

## Features

- **Intelligent Feed Processing**: Automated ingestion from podcasts, RSS feeds, YouTube channels, and APIs
- **AI-Powered Analysis**: GPT-4 driven market analysis with daily synthesis reports
- **Predictive Intelligence**: Multi-horizon predictions with confidence scoring
- **Real-time Monitoring**: Live dashboard with market sentiment visualization
- **Stock Scanner**: Advanced screening for earnings momentum and P/E ratio anomalies

## Tech Stack

- **Backend**: Node.js, TypeScript, Express, Supabase
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **AI**: OpenAI GPT-4, Whisper (local transcription)
- **Deployment**: Netlify (serverless functions + static hosting)

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/silver-fin-monitor.git
cd silver-fin-monitor

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Development

```bash
# Start backend server
npm run dev

# In another terminal, start frontend
cd frontend && npm run dev
```

### Deployment

See [DEPLOY.md](DEPLOY.md) for detailed deployment instructions.

## Environment Variables

Required environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `OPENAI_API_KEY`: OpenAI API key
- `JWT_SECRET`: Secret for JWT tokens (min 32 characters)

## Architecture

The system follows a microservices architecture with:
- Database-based job queue system
- Circuit breaker pattern for resilience
- Multi-layer caching strategy
- Serverless deployment on Netlify

## Documentation

- [Deployment Guide](DEPLOY.md)
- [API Documentation](docs/API.md)
- [Architecture Overview](CLAUDE.md)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Status

🚧 **Beta Release** - Core functionality is complete, TypeScript migration in progress.