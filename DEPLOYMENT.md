# 🚀 Deployment Guide

This guide will help you deploy AutonotePro to GitHub and optionally to a hosting platform.

## 📋 Prerequisites

- Git installed on your machine
- GitHub account
- Node.js installed (for backend)

## 🔄 Pushing to GitHub

### Step 1: Initialize Git Repository

If you haven't already initialized a git repository:

```bash
cd /Users/yogayjain/AutonotePro
git init
```

### Step 2: Add Files to Git

```bash
# Add all files (respecting .gitignore)
git add .

# Check what will be committed
git status
```

### Step 3: Create Initial Commit

```bash
git commit -m "Initial commit: AutonotePro v1.0

- Modern Glassmorphism UI design
- Backend with UUID-based data management
- Real-time sync with Socket.io
- AI summarization and cloud backup features
- Fully responsive design with dark mode"
```

### Step 4: Connect to GitHub Repository

```bash
# Add remote repository
git remote add origin https://github.com/jainyogya07/AutonotePro.git

# Or if you want to use the Gratitude-Reminder repo:
# git remote add origin https://github.com/jainyogya07/Gratitute-Reminder.git
```

### Step 5: Push to GitHub

```bash
# Push to main branch
git branch -M main
git push -u origin main
```

## 🌐 Deployment Options

### Option 1: GitHub Pages (Frontend Only)

GitHub Pages can host the frontend as a static site, but you'll need a separate backend host.

1. **Create a `gh-pages` branch**
   ```bash
   git checkout -b gh-pages
   ```

2. **Copy frontend to root**
   ```bash
   cp -r frontend/* .
   git add .
   git commit -m "Deploy frontend to GitHub Pages"
   git push origin gh-pages
   ```

3. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Select `gh-pages` branch
   - Your site will be at `https://jainyogya07.github.io/AutonotePro`

### Option 2: Render (Backend) + Netlify (Frontend)

#### Backend on Render

1. **Create `render.yaml`** (in project root):
   ```yaml
   services:
     - type: web
       name: autonote-backend
       env: node
       buildCommand: cd backend && npm install
       startCommand: cd backend && npm start
       envVars:
         - key: PORT
           value: 8080
         - key: HF_TOKEN
           sync: false
         - key: GITHUB_TOKEN
           sync: false
   ```

2. **Deploy to Render**
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository
   - Create a new Web Service
   - Set environment variables in Render dashboard

#### Frontend on Netlify

1. **Update API URL** in `frontend/script.js`:
   ```javascript
   const API_URL = 'https://your-app.onrender.com';
   ```

2. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `frontend` folder
   - Or connect GitHub repo and set:
     - Build command: (leave empty)
     - Publish directory: `frontend`

### Option 3: Heroku (Full Stack)

1. **Create `Procfile`** (in project root):
   ```
   web: cd backend && npm start
   ```

2. **Deploy**
   ```bash
   heroku create autonote-pro
   heroku config:set HF_TOKEN=your_token
   heroku config:set GITHUB_TOKEN=your_token
   git push heroku main
   ```

### Option 4: Vercel (Full Stack)

1. **Create `vercel.json`**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "backend/index.js",
         "use": "@vercel/node"
       },
       {
         "src": "frontend/*",
         "use": "@vercel/static"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "backend/index.js"
       },
       {
         "src": "/(.*)",
         "dest": "frontend/$1"
       }
     ]
   }
   ```

2. **Deploy**
   ```bash
   npx vercel
   ```

## 🔐 Environment Variables Setup

For production deployments, always set these environment variables in your hosting platform's dashboard:

- `PORT` - Server port (usually auto-set by platform)
- `HF_TOKEN` - Your HuggingFace API token
- `GITHUB_TOKEN` - Your GitHub personal access token

**Never commit `.env` file to Git!** It's already in `.gitignore`.

## ✅ Post-Deployment Checklist

- [ ] Backend is running and accessible
- [ ] Frontend can connect to backend API
- [ ] Environment variables are set correctly
- [ ] HTTPS is enabled (required for voice input)
- [ ] CORS is configured properly
- [ ] Data persistence is working

## 🐛 Troubleshooting

### Issue: Frontend can't connect to backend
**Solution**: Update `API_URL` in `frontend/script.js` to your backend URL

### Issue: Voice input not working
**Solution**: Voice input requires HTTPS. Use a hosting platform that provides SSL.

### Issue: AI features not working
**Solution**: Verify `HF_TOKEN` is set correctly in environment variables

### Issue: Real-time sync not working
**Solution**: Ensure Socket.io can establish WebSocket connections (check firewall/proxy settings)

## 📚 Additional Resources

- [GitHub Pages Documentation](https://pages.github.com/)
- [Render Documentation](https://render.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Heroku Documentation](https://devcenter.heroku.com/)
- [Vercel Documentation](https://vercel.com/docs)

---

Need help? Open an issue on GitHub!
