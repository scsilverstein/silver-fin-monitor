# Deploying Silver Fin Monitor to Netlify

This guide explains how to deploy the Silver Fin Monitor application to Netlify.

## Quick Start - Manual Deployment

Since there are TypeScript compilation issues that need to be resolved, here's how to deploy manually:

1. **Create a GitHub Repository**
   ```bash
   # Create a new repository on GitHub
   # Then add it as a remote:
   git remote add origin https://github.com/YOUR_USERNAME/silver-fin-monitor.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy via Netlify Dashboard**
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub account
   - Select the `silver-fin-monitor` repository
   - Netlify will auto-detect the configuration from `netlify.toml`
   - Click "Deploy site"

3. **Handle Build Errors**
   - The initial build may fail due to TypeScript errors
   - Go to Site settings → Build & deploy → Build settings
   - Change the build command to: `echo "Skipping build"`
   - This will deploy the placeholder page while you fix TypeScript errors

## Fixing TypeScript Errors

The main issues to resolve:

1. **Frontend TypeScript Errors**
   - Property name mismatches (snake_case vs camelCase)
   - Missing type definitions
   - Unused imports

2. **Backend TypeScript Errors**
   - Strict null checks
   - Missing error handling types
   - Property access on possibly undefined objects

To fix these locally:
```bash
# Fix frontend
cd frontend
npm run typecheck  # See all errors
# Fix errors in your IDE

# Fix backend
cd ..
npm run typecheck  # See all errors
# Fix errors in your IDE
```

## Prerequisites

1. A Netlify account (free tier is sufficient)
2. Git repository (GitHub, GitLab, or Bitbucket)
3. Supabase project with database configured
4. OpenAI API key for AI features

## Deployment Steps

### 1. Prepare the Repository

Ensure your repository includes all the necessary files:
- `netlify.toml` (deployment configuration)
- `netlify/functions/api.ts` (serverless API function)
- Frontend code in `frontend/` directory
- All dependencies in `package.json`

### 2. Connect to Netlify

1. Log in to [Netlify](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git provider and select the repository
4. Netlify will automatically detect the configuration from `netlify.toml`

### 3. Configure Environment Variables

In Netlify dashboard → Site settings → Environment variables, add:

```env
# Required Environment Variables
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret_at_least_32_chars

# Optional Environment Variables
NODE_ENV=production
OPENAI_MODEL=gpt-4
OPENAI_FALLBACK_MODEL=gpt-3.5-turbo
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Deploy Settings

The `netlify.toml` file configures:
- Build command: `npm run build && cd frontend && npm install && npm run build`
- Publish directory: `frontend/dist`
- Functions directory: `netlify/functions`
- Node.js version: 20

### 5. Deploy the Site

1. Click "Deploy site" in Netlify
2. Wait for the build to complete (usually 2-5 minutes)
3. Your site will be available at `https://your-site-name.netlify.app`

### 6. Test the Deployment

1. Visit your deployed site
2. Check the health endpoint: `https://your-site-name.netlify.app/.netlify/functions/api/health`
3. Test the login functionality
4. Verify API endpoints are working

## Local Development

To test Netlify Functions locally:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run locally with functions
netlify dev
```

This will start:
- Frontend on http://localhost:9999
- Functions on http://localhost:9999/.netlify/functions/

## Troubleshooting

### Build Failures

If the build fails:
1. Check the build logs in Netlify dashboard
2. Ensure all dependencies are in `package.json`
3. Verify TypeScript compilation succeeds locally

### Function Errors

If API calls fail:
1. Check function logs in Netlify dashboard → Functions tab
2. Verify environment variables are set correctly
3. Test the function endpoint directly

### CORS Issues

The `netlify.toml` includes CORS headers. If you still face issues:
1. Check browser console for specific CORS errors
2. Verify the frontend is using relative URLs for API calls
3. Ensure no hardcoded localhost URLs in production

## Production Considerations

### Performance

- Netlify Functions have a 10-second timeout
- Cold starts may take 1-2 seconds
- Consider implementing caching for frequently accessed data

### Security

- Never commit sensitive keys to the repository
- Use environment variables for all secrets
- Enable HTTPS (automatic with Netlify)
- Review security headers in `netlify.toml`

### Monitoring

1. Enable Netlify Analytics (paid feature) for traffic insights
2. Use function logs for API monitoring
3. Set up alerts for function errors

### Scaling

- Netlify Functions scale automatically
- Monitor usage in Netlify dashboard
- Consider upgrading plan if hitting limits

## Continuous Deployment

Netlify automatically deploys when you push to the connected branch:
1. Push changes to your repository
2. Netlify detects changes and starts a new build
3. If build succeeds, the new version is deployed
4. Old version remains active if build fails

## Environment-Specific Configuration

### Production
- Uses Netlify Functions for API
- Optimized frontend build
- Security headers enabled

### Preview Deployments
- Created for pull requests
- Separate environment from production
- Useful for testing changes

## Cost Considerations

Free tier includes:
- 100GB bandwidth/month
- 300 build minutes/month
- 125k serverless function requests/month

Monitor usage in Netlify dashboard to avoid overages.

## Next Steps

After deployment:
1. Set up custom domain (optional)
2. Configure SSL certificate (automatic with custom domain)
3. Enable form notifications (if using Netlify Forms)
4. Set up deployment notifications
5. Configure build hooks for external triggers