# Netlify Dev Setup Instructions

## Configuration Complete

The Netlify dev server has been configured to:
- Serve on port 9999
- Proxy to the backend server running on port 3001
- Handle all API requests through Netlify dev

## To Start:

1. Make sure the backend server is running:
   ```bash
   npm run dev
   ```

2. In a new terminal, start Netlify dev from the project root:
   ```bash
   netlify dev
   ```

3. Access the application at:
   - Frontend: http://localhost:9999
   - API: http://localhost:9999/api/v1/stocks/screener

## What Changed:

1. **netlify.toml**: 
   - Changed port from 9999 to 9999
   - Set targetPort to 3001 (backend server)
   - Set command to "npm run dev"

2. **frontend/src/lib/api.ts**:
   - Updated to use port 9999 for API requests
   - All frontend API calls will go to http://localhost:9999/api/v1

## Testing:

Once Netlify dev is running, you can test the stock screener at:
```bash
curl http://localhost:9999/api/v1/stocks/screener
```

The frontend will automatically use port 9999 for all API requests.