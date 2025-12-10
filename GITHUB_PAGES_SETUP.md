# GitHub Pages Deployment Setup

## Problem
GitHub Pages shows "No data available" because environment variables from `.env` are not included in the production build.

## Solution
Configure environment variables as GitHub Secrets so they're available during the build process.

## Steps to Fix

### 1. Add GitHub Secrets

1. Go to your GitHub repository: **https://github.com/mocialov/buy_the_fucking_dip**

2. Click **Settings** tab

3. In the left sidebar, click **Secrets and variables** → **Actions**

4. Click **New repository secret** button

5. Add these three secrets (one at a time):

   **Secret 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://nxxkigmpwwwftspochwn.supabase.co`
   
   **Secret 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGtpZ21wd3d3ZnRzcG9jaHduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NDU3MDQsImV4cCI6MjA4MDUyMTcwNH0.o6pCv6yttvYQwWCDYojunOcAycIc2UP0c_y3sCI_7gE`
   
   **Secret 3:**
   - Name: `VITE_TWELVE_DATA_API_KEY`
   - Value: `1e84c56991a24d25ba629f833087c00d`

### 2. Trigger a New Deployment

After adding the secrets, trigger a new build:

**Option A: Push a new commit**
```bash
git commit --allow-empty -m "Trigger rebuild with secrets"
git push
```

**Option B: Re-run the workflow**
1. Go to **Actions** tab in GitHub
2. Click on the latest "Deploy to GitHub Pages" workflow
3. Click **Re-run all jobs**

### 3. Verify

Once the deployment completes:
1. Go to your GitHub Pages site
2. Open browser DevTools (F12) → Console
3. You should now see: `✓ Supabase client initialized`
4. Select a sector and verify data loads from Supabase

## How It Works

### Local Development
- Vite reads from `.env` file
- Environment variables available at build time
- Supabase client initializes successfully

### GitHub Pages Deployment
- `.env` file is not committed (in `.gitignore`)
- GitHub Actions workflow reads from GitHub Secrets
- Secrets are passed as environment variables during `npm run build`
- Vite bakes the values into the production build
- Static files deployed to GitHub Pages include the credentials

## Security Notes

✅ **Safe to use:**
- `VITE_SUPABASE_ANON_KEY` - This is the public anonymous key, designed to be exposed in frontend code
- It's protected by Row Level Security (RLS) policies in Supabase

❌ **Never expose:**
- `SUPABASE_SERVICE_ROLE_KEY` - Keep this secret! Only use for backend/sync scripts

## Troubleshooting

If it still doesn't work after adding secrets:

1. **Check if secrets were added correctly:**
   - Go to Settings → Secrets and variables → Actions
   - Verify all 3 secrets are listed

2. **Check the build logs:**
   - Go to Actions tab
   - Click on the latest workflow run
   - Look for any errors in the "Build" step

3. **Check browser console:**
   - Open your GitHub Pages site
   - Press F12 → Console
   - Look for: `✓ Supabase client initialized` or `⚠️ Supabase credentials not found`

4. **Clear cache:**
   - Hard refresh your browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
