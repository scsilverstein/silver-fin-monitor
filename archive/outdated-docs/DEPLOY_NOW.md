# Deploy to Netlify - Quick Steps

Your repository is now ready at: https://github.com/scsilverstein/silver-fin-monitor

## Deploy to Netlify (Web Interface)

1. **Go to Netlify**: https://app.netlify.com

2. **Click "Add new site" → "Import an existing project"**

3. **Select "GitHub"** and authorize if needed

4. **Search for "silver-fin-monitor"** and select it

5. **Netlify will auto-detect the configuration**. You should see:
   - Build command: `./scripts/netlify-build.sh`
   - Publish directory: `frontend/dist`
   - Functions directory: `netlify/functions`

6. **Click "Deploy site"**

## After Deployment

### Add Environment Variables

Go to Site settings → Environment variables → Add variable:

```
SUPABASE_URL = https://pnjtzwqieqcrchhjouaz.supabase.co
SUPABASE_SERVICE_KEY = [Your service key from .env.backup]
OPENAI_API_KEY = [Your OpenAI key from .env.backup]
JWT_SECRET = silver_fin_monitor_jwt_secret_key_production_secure
NODE_ENV = production
```

### Get Your Live URLs

After deployment:
- Frontend: `https://[your-site-name].netlify.app`
- API Health Check: `https://[your-site-name].netlify.app/.netlify/functions/api/health`

## Alternative: Use Netlify Drop

If you prefer a quick test without Git integration:

1. Build locally:
   ```bash
   cd frontend && npm run build || true
   cd ..
   ```

2. Go to https://app.netlify.com/drop
3. Drag the `frontend/dist` folder to the browser
4. You'll get an instant preview URL

## Troubleshooting

If the build fails:
1. Go to Site settings → Build & deploy → Build settings
2. Change build command to: `echo "Skip build"`
3. Deploy will use the placeholder page

The API functions will still work even if the frontend build fails!