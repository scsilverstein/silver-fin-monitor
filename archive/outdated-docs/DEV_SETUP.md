# Silver Fin Monitor - Development Setup

## Quick Start

### Automatic Rebuilding Development Environment

For the best development experience with automatic rebuilding of both frontend and backend:

```bash
# Option 1: Use the auto-rebuild script
./run-dev-auto.sh

# Option 2: Use npm script
npm run dev:auto

# Option 3: Manual concurrent commands
npm run dev:netlify
```

### What Gets Auto-Rebuilt

1. **Netlify Functions** (TypeScript → JavaScript)
   - Watches `netlify/functions/api.ts`
   - Rebuilds on any changes
   - Hot reloads the function

2. **Frontend** (React + Vite)
   - Watches all frontend source files
   - Hot Module Replacement (HMR)
   - Instant updates in browser

### Ports

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8888/api/v1
- **Netlify Dev**: http://localhost:8888

### Troubleshooting

#### Port Already in Use
```bash
# Check what's using the ports
lsof -i :5173
lsof -i :8888

# Kill the process if needed
kill -9 <PID>
```

#### Function Not Rebuilding
```bash
# Manually rebuild the function
npm run build:function

# Or restart the dev server
./run-dev-auto.sh
```

#### Environment Variables Not Loading
Make sure you have a `.env` file in the root directory with all required variables:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY
- OPENAI_API_KEY

### Development Workflow

1. **Start the dev server**: `./run-dev-auto.sh`
2. **Make changes** to any TypeScript/React files
3. **See changes** automatically reflected:
   - Frontend updates instantly via HMR
   - Backend functions rebuild and reload
4. **Test API endpoints** at http://localhost:8888/api/v1

### Queue Worker Management

The queue worker controls are available at:
- **UI**: http://localhost:5173/queue
- **API**: http://localhost:8888/api/v1/queue/worker/status

To test worker operations:
```bash
# Check worker status
curl http://localhost:8888/api/v1/queue/worker/status

# Start worker
curl -X POST http://localhost:8888/api/v1/queue/worker/start

# Stop worker
curl -X POST http://localhost:8888/api/v1/queue/worker/stop

# Restart worker
curl -X POST http://localhost:8888/api/v1/queue/worker/restart
```