# Ready to Test - Complete Guide

## ✅ What's Set Up

You now have:
- ✅ **Supabase database** - Ready at `https://kxysgyvqguanyigtttaq.supabase.co`
- ✅ **All backend code** - Fully implemented
- ✅ **Unity client code** - With API integration
- ✅ **Your BookVid services** - Twilio, SendGrid, Sentry, GCS

**Status: 95% ready to test locally!**

---

## 🚀 Test in 3 Steps (10 Minutes Total)

### Step 1: Initialize Database (2 minutes)

1. Open Supabase dashboard:
   ```
   https://kxysgyvqguanyigtttaq.supabase.co
   ```

2. Go to **SQL Editor** (left sidebar)

3. Click **New Query**

4. Copy **entire contents** of:
   ```
   WebappBackend/database/schema.sql
   ```

5. Paste into SQL Editor

6. Click **Run** button

7. Should see: "Success. No rows returned"

8. Go to **Table Editor** → Should see 3 new tables:
   - `stream_sessions`
   - `stream_viewers`
   - `stream_recordings`

✅ **Database ready!**

---

### Step 2: Create .env File (2 minutes)

In `WebappBackend/` folder, create a new file named `.env`:

```bash
NODE_ENV=development
PORT=80

# Database - READY ✅
SUPABASE_URL=https://kxysgyvqguanyigtttaq.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eXNneXZxZ3VhbnlpZ3R0dGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjM4NzYsImV4cCI6MjA3NjczOTg3Nn0.C53OUkB76_SwXIAurfbb2gWxY02Y-fPUUwrAnI9AXR8

# Copy these exact values from your main BookVid app's .env file:
JWT_SECRET=PASTE_SECRET_KEY_VALUE_HERE
TWILIO_ACCOUNT_SID=PASTE_TWILIO_SID_HERE
TWILIO_AUTH_TOKEN=PASTE_TWILIO_TOKEN_HERE
SENDGRID_API_KEY=PASTE_SENDGRID_KEY_HERE
SENTRY_DSN=PASTE_SENTRY_DSN_HERE
GCP_JSON_CREDENTIALS=PASTE_GCP_CREDENTIALS_HERE

# BookVid configuration
FROM_EMAIL=notifications@bookvid.com
GCLOUD_STORAGE_BUCKET=bookvid-prod-vr-recordings
STREAM_VIEWER_URL=https://bookvid.com
ALLOWED_ORIGINS=https://bookvid.com,http://localhost:3000
```

**Save the file as `.env`** (NOT .env.txt or anything else)

---

### Step 3: Start Backend & Test (5 minutes)

```bash
cd WebappBackend
npm install
npm run dev
```

Should see output ending with server running messages.

**Test health check:**

Open new terminal:
```bash
curl http://localhost/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 0.123,
  "timestamp": 1729123456789,
  "environment": "development",
  "features": {
    "database": true,     ✅
    "storage": false,     ⚠️ GCS needs credentials
    "notifications": true, ✅
    "auth": true          ✅
  }
}
```

**✅ If 3/4 features are true, you're ready!**

(Storage will be false until you add GCP_JSON_CREDENTIALS - but everything else works)

---

## 🎮 Test Unity Streaming (5 minutes)

### Option 1: Without Auth (Quick Test)

The backend will work without auth for testing:

1. Open `client/public/receiver/index.html` in browser
2. Click "Play" button
3. Open Unity project
4. Press Play
5. Press `L` key
6. **Video should stream to browser!** 🎉

### Option 2: With Auth (Production Flow)

Set auth token in Unity:

```csharp
// In Unity Console window, run:
PlayerPrefs.SetString("AuthToken", "your-jwt-token-from-bookvid");
PlayerPrefs.Save();
```

Then configure `RenderStreamControl` in Inspector:
- Backend URL: `http://localhost`

Test streaming - should see in console:
```
✅ Stream session created: uuid-here
```

Check Supabase → Table Editor → `stream_sessions` → Should see new row!

---

## 🎯 What Each Test Validates

### Basic Streaming Test (Without Auth)
Tests:
- ✅ WebRTC connection works
- ✅ Video quality is good
- ✅ Audio works
- ✅ Unity → Backend → Browser flow

Doesn't test:
- Session tracking (needs auth token)
- Recording upload (needs GCS credentials)
- Email notifications (needs parent email)

### Full Test (With Auth)
Tests everything:
- ✅ Authentication works
- ✅ Session created in database
- ✅ WebRTC connection
- ✅ Video and audio
- ⚠️ Recording (needs GCS credentials)
- ⚠️ Notifications (needs parent email integration)

---

## 📊 Testing Checklist

### Local Backend Tests

- [ ] Run database schema in Supabase
- [ ] Create .env file
- [ ] Start backend (`npm run dev`)
- [ ] Test `/health` endpoint
- [ ] Verify 3-4 features enabled

### Streaming Tests

- [ ] Open receiver page in browser
- [ ] Start Unity and press `L`
- [ ] Video appears in browser
- [ ] Quality is 1080p @ 30fps
- [ ] Audio works
- [ ] No lag or stuttering

### API Tests (With JWT Token)

- [ ] Generate or get JWT token from BookVid
- [ ] Test `POST /api/sessions/start`
- [ ] Verify session in Supabase
- [ ] Test `GET /api/sessions/active`
- [ ] Test `POST /api/sessions/end/:id`

### Unity Integration Tests

- [ ] Set auth token in PlayerPrefs
- [ ] Configure backend URL in Inspector
- [ ] Start streaming
- [ ] Check console for "Session created" message
- [ ] Verify session in Supabase database

---

## 🐛 Common Issues & Fixes

### "Cannot find module '@supabase/supabase-js'"

```bash
cd WebappBackend
npm install
```

### ".env file not loaded"

Make sure it's named exactly `.env` (not `.env.txt`)

Location: `/Users/jesselinson/substream-sdk/WebappBackend/.env`

### "Database features: false"

Check Supabase credentials in .env are correct:
```bash
# Test connection
curl "https://kxysgyvqguanyigtttaq.supabase.co/rest/v1/" \
  -H "apikey: YOUR_SUPABASE_KEY"
```

### "Unity can't connect"

Make sure backend is running:
```bash
curl http://localhost/health
```

Update Unity Stream-Settings.asset:
```
m_url: ws://localhost
```

---

## 🎉 Success!

When you see:
- ✅ Health check shows features enabled
- ✅ Video streams from Unity to browser
- ✅ Session appears in Supabase
- ✅ Good video quality

**You're ready to deploy to production!**

---

## 🚀 Deploy to Production (30 min)

Once local testing works:

1. Go to Railway
2. Create new project from GitHub
3. Set environment variables (same as .env)
4. Deploy
5. Update Unity with Railway URL
6. Test on Quest

See `docs/PRODUCTION_DEPLOYMENT.md` for details.

---

## 💡 Faster Alternative: LiveKit

Remember, you already have LiveKit configured. Test that too:

```bash
cd ~/livekit-vr-test
# See BOOKVID_QUICK_START.md for LiveKit testing
```

Compare:
- Unity Render Streaming (this repo)
- LiveKit (test repo)

Choose whichever works better!

---

## 📞 Need Help?

If anything fails:
1. Check backend console logs
2. Check Unity console logs
3. Test `/health` endpoint
4. Verify .env file has all values
5. Check Supabase SQL Editor for schema errors

**You're so close - literally minutes away from working!** 🎯

