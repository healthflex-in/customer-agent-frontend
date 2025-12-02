# Deployment Configuration Guide

This document explains how the application handles different environments (development vs production) and how to configure API and WebSocket URLs.

## Overview

The application now uses a centralized configuration system that automatically switches between development and production URLs based on the build mode.

## Configuration Files

### 1. API Configuration (`src/config/api.ts`)

This is the main configuration file that manages all API and WebSocket URLs. It automatically detects the environment and uses appropriate defaults:

- **Development Mode** (`npm run dev`):
  - API URL: `http://localhost:8000`
  - WebSocket URL: `ws://localhost:8000`

- **Production Mode** (`npm run build`):
  - API URL: `https://customeragent.stance.health`
  - WebSocket URL: `wss://customeragent.stance.health`

### 2. Environment Variables (Optional)

You can override the default URLs by creating environment files:

#### `.env.development` (for local development)
```bash
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

#### `.env.production` (for production builds)
```bash
VITE_API_URL=https://customeragent.stance.health
VITE_WS_URL=wss://customeragent.stance.health
```

#### `.env` (default fallback)
```bash
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

**Note:** Environment files (`.env*`) are ignored by git for security. You need to create them manually on each environment.

## Updated Files

The following files have been updated to use the centralized configuration:

1. **`src/hooks/useWebSocket.ts`**
   - Now uses `getWsUrl()` for WebSocket connections
   - Automatically connects to the correct WebSocket server based on environment

2. **`src/components/TranscriptionInterface.tsx`**
   - Uses `getApiUrl()` for file upload endpoints
   - No longer hardcodes localhost URLs

3. **`src/pages/Index.tsx`**
   - Uses `getApiUrl()` for fetching users
   - Dynamically switches between dev and prod APIs

4. **`src/pages/FormSelection.tsx`**
   - Uses `getApiUrl()` for fetching user forms
   - Consistent with other API calls

## Build Commands

### Development
```bash
npm run dev
```
- Runs Vite dev server
- Uses development URLs (localhost:8000)
- Hot module replacement enabled

### Production Build
```bash
npm run build
```
- Creates optimized production build
- Uses production URLs (customeragent.stance.health)
- Output in `dist/` directory

### Preview Production Build
```bash
npm run preview
```
- Preview the production build locally
- Still uses production URLs

## Deployment Steps

### 1. For Development Environment

```bash
# No special configuration needed
npm run dev
```

### 2. For Production Deployment

```bash
# Build for production
npm run build

# The dist/ folder is ready to deploy
# Deploy to your hosting service (Vercel, Netlify, etc.)
```

### 3. For Staging/Custom Environment

Create a custom environment file:

```bash
# .env.staging
VITE_API_URL=https://staging.customeragent.stance.health
VITE_WS_URL=wss://staging.customeragent.stance.health
```

Then build with:
```bash
npm run build -- --mode staging
```

## Testing the Configuration

### Check Current Configuration

You can verify which URLs are being used by checking the browser console:

```javascript
// In browser console
import { API_CONFIG } from './src/config/api';
console.log('API URL:', API_CONFIG.API_URL);
console.log('WS URL:', API_CONFIG.WS_URL);
```

### Test API Connectivity

1. **Development:**
   - Ensure backend is running on `http://localhost:8000`
   - Run `npm run dev`
   - Check browser console for connection status

2. **Production:**
   - Ensure `https://customeragent.stance.health` is accessible
   - Build and deploy: `npm run build`
   - Check browser console for connection status

## Troubleshooting

### Issue: "WebSocket connection failed"

**Solution:**
- Verify the backend server is running
- Check CORS settings on the backend
- Ensure WebSocket URL uses correct protocol (ws:// for HTTP, wss:// for HTTPS)

### Issue: "API calls returning 404"

**Solution:**
- Verify the API URL is correct
- Check network tab in browser dev tools
- Ensure backend routes match the frontend paths

### Issue: "Environment variables not working"

**Solution:**
- Ensure `.env` files are in the project root (same level as `package.json`)
- Restart the dev server after changing `.env` files
- Verify variable names start with `VITE_` prefix
- Check that `.env` files are not in `.gitignore` (they should be)

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use environment variables** for sensitive data
3. **HTTPS/WSS in production** - Always use secure protocols in production
4. **CORS configuration** - Ensure backend allows requests from your frontend domain

## Helper Functions

The `src/config/api.ts` file exports helper functions:

```typescript
// Get full API URL
getApiUrl('/api/users') 
// Returns: http://localhost:8000/api/users (dev)
// Returns: https://customeragent.stance.health/api/users (prod)

// Get full WebSocket URL
getWsUrl('/ws')
// Returns: ws://localhost:8000/ws (dev)
// Returns: wss://customeragent.stance.health/ws (prod)
```

## Migration from Hardcoded URLs

All hardcoded URLs have been replaced:

| Old Value | New Value |
|-----------|-----------|
| `"ws://localhost:8000"` | `getWsUrl()` |
| `"http://localhost:8000/api/..."` | `getApiUrl("/api/...")` |
| `"https://customeragent.stance.health/api/..."` | `getApiUrl("/api/...")` |

## Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [React Best Practices for API Configuration](https://react.dev/learn)
- Backend API Documentation: [Add your backend docs link here]

