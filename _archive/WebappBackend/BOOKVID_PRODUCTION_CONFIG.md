# BookVid Production Configuration

## 🎉 HUGE Discovery: You Already Have Most Services!

Based on your credentials, you already have:

✅ **Twilio** (TURN servers)  
✅ **SendGrid** (Email notifications)  
✅ **Sentry** (Error tracking)  
✅ **LiveKit** (Fully configured!)  
✅ **Google Cloud Storage** (Can use for recordings)  

**This changes everything!**

---

## 💡 Critical Decision Point

### You Already Have LiveKit!

Your credentials show you already have LiveKit configured (see your main app's .env for actual values).

**Recommendation:** Use the **LiveKit test repo** I created instead of Unity Render Streaming!

### Why LiveKit Makes More Sense Now:

1. ✅ **You're already paying for it**
2. ✅ **Recording bucket already configured**
3. ✅ **Much simpler integration** (~300 lines vs 1400+)
4. ✅ **Your backend already has LiveKit** (for video calls?)
5. ✅ **Auto-recording to your existing bucket**
6. ✅ **All TURN servers included**

**Time savings:** 2 weeks → 1 week (everything already configured!)

---

## Option A: Use LiveKit (RECOMMENDED)

### Immediate Steps (1-2 days):

1. **Use the test repo I created:**
   ```bash
   git clone https://github.com/jlin3/livekit-vr-test.git
   cd livekit-vr-test/backend
   ```

2. **Configure with your existing credentials:**
   Create `backend/.env`:
   ```bash
   PORT=3001
   
   # Your existing LiveKit credentials (copy from main app .env)
   LIVEKIT_URL=<your-livekit-url>
   LIVEKIT_API_KEY=<your-livekit-api-key>
   LIVEKIT_API_SECRET=<your-livekit-api-secret>
   ```

3. **Test immediately:**
   ```bash
   npm install
   npm run dev
   # Open viewer/index.html in browser
   ```

4. **Add to Unity:**
   - Install LiveKit Unity SDK
   - Copy `unity-setup/LiveKitTest.cs`
   - Configure backend URL
   - Test in 15 minutes!

**Total time to working prototype: 2-3 hours**

---

## Option B: Use Unity Render Streaming (Current Plan)

If you still want to use Unity Render Streaming with your existing services:

### Production .env Configuration

Create `WebappBackend/.env` with:

```bash
# ==========================================
# Server Configuration
# ==========================================
NODE_ENV=production
PORT=443

# ==========================================
# Security - Use your existing SECRET_KEY
# ==========================================
JWT_SECRET=qJaAJPP8mElk9sRe9oPz87qrKiDLMFmY=

# Your existing CORS origins
ALLOWED_ORIGINS=https://bookvid.com,https://www.bookvid.com,http://localhost:3000,http://localhost:3001

# ==========================================
# Database - Need to create Supabase OR use MySQL
# ==========================================
# OPTION 1: Create new Supabase project (easiest)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# OPTION 2: Use your existing MySQL (requires code changes)
# MYSQL_HOST=/cloudsql/bookvid-be-prod:us-central1:viddb-prod
# MYSQL_USER=root
# MYSQL_PASS=bookvidrockets
# MYSQL_DB=vidDB

# ==========================================
# Storage - Use Google Cloud Storage (you already have!)
# ==========================================
# Copy from your main app's .env file
GCLOUD_STORAGE_BUCKET=bookvid-prod-vr-recordings
GCS_SIGNING_SERVICE_ACCOUNT_EMAIL=<your-gcs-service-account-email>
GCP_JSON_CREDENTIALS=<your-gcp-json-credentials>

# ==========================================
# TURN Servers - Use your existing Twilio! ✅
# ==========================================
# Copy from your main app's .env file
TWILIO_ACCOUNT_SID=<your-existing-twilio-sid>
TWILIO_AUTH_TOKEN=<your-existing-twilio-token>

# ==========================================
# Email - Use your existing SendGrid! ✅
# ==========================================
# Copy from your main app's .env file
SENDGRID_API_KEY=<your-existing-sendgrid-key>
FROM_EMAIL=notifications@bookvid.com

# ==========================================
# Monitoring - Use your existing Sentry! ✅
# ==========================================
# Copy from your main app's .env file
SENTRY_DSN=<your-existing-sentry-dsn>

# ==========================================
# Stream Viewer URL
# ==========================================
STREAM_VIEWER_URL=https://bookvid.com
```

---

## 💰 Updated Cost Analysis

### With Your Existing Services:

| Service | Status | Cost |
|---------|--------|------|
| Twilio | ✅ Existing | $0 new |
| SendGrid | ✅ Existing | $0 new |
| Sentry | ✅ Existing | $0 new |
| LiveKit | ✅ Existing | $0 new |
| GCS | ✅ Existing | Marginal |
| Supabase | ⬜ Need | $0-25/month |
| Railway | ⬜ Need | $20-50/month |

**NEW MONTHLY COST: $20-75/month** instead of $155-371/month! 💰

---

## 🎯 Strong Recommendation: Use LiveKit

Since you **already have LiveKit configured with recording bucket**, I strongly recommend:

### Immediate Action Plan (1 week instead of 3):

1. **Today: Test LiveKit VR streaming**
   - Use the test repo: `https://github.com/jlin3/livekit-vr-test`
   - Configure with your LiveKit credentials
   - Test in Unity Editor
   - Test on Quest

2. **If LiveKit works (likely):**
   - Deploy LiveKit backend (already written)
   - Skip all the Unity Render Streaming complexity
   - Use your existing recording bucket
   - **Launch in 1 week instead of 3!**

3. **If LiveKit doesn't work:**
   - Fall back to Unity Render Streaming
   - But still use your existing Twilio, SendGrid, Sentry
   - Save $135-296/month

---

## 🚀 Next Steps

### Path 1: Test LiveKit First (RECOMMENDED)

```bash
cd ~/
git clone https://github.com/jlin3/livekit-vr-test.git
cd livekit-vr-test/backend

# Create .env
cat > .env << EOF
PORT=3001
LIVEKIT_URL=<your-livekit-url>
LIVEKIT_API_KEY=<your-livekit-api-key>
LIVEKIT_API_SECRET=<your-livekit-api-secret>
EOF

npm install
npm run dev
```

Open `viewer/index.html` → Test in Unity → If it works, **you're done in days, not weeks!**

### Path 2: Continue with Unity Render Streaming

Use the config above, but you'll save significant money using your existing services.

---

## 🎁 What Your Credentials Give You

I'll create updated configs for both paths that use your existing services. Want me to:

1. **Update Unity Render Streaming backend** to use GCS instead of S3?
2. **Create LiveKit integration** using your existing LiveKit setup?
3. **Both** so you can compare?

**What would you like me to do?**
