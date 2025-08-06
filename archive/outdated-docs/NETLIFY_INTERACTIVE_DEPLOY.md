# Interactive Netlify Deployment Guide

Follow these steps in your terminal:

## 1. Switch to Node 18
```bash
source ~/.nvm/nvm.sh && nvm use 18
```

## 2. Start Netlify Deployment
```bash
netlify deploy --dir frontend/dist --prod
```

## 3. When prompted "What would you like to do?"
- Press DOWN ARROW to select: `+ Create & configure a new project`
- Press ENTER

## 4. When prompted "Team:"
- Select `silversoftwerks's team`
- Press ENTER

## 5. When prompted "Your project is going to be set up with the following:"
- Press ENTER to confirm

## 6. Site name (optional)
- Type: `silver-fin-monitor`
- Press ENTER

## 7. The deployment will proceed automatically

## 8. After deployment, add environment variables:
```bash
netlify env:set SUPABASE_URL "https://pnjtzwqieqcrchhjouaz.supabase.co"
netlify env:set SUPABASE_SERVICE_KEY "your_service_key_here"
netlify env:set OPENAI_API_KEY "your_openai_key_here"
netlify env:set JWT_SECRET "silver_fin_monitor_jwt_secret_key_production"
netlify env:set NODE_ENV "production"
```

## 9. Redeploy with environment variables:
```bash
netlify deploy --dir frontend/dist --prod
```

Your site will be live at the URL shown in the output!