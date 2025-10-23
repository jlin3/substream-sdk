# Developer Setup Guide

Complete guide for deploying this VR streaming platform from scratch.

---

## 🎯 What This Platform Does

Stream high-quality VR gameplay (1080p @ 60fps) from Quest headsets to web browsers with:
- ✅ Automatic recording to cloud storage
- ✅ Parent email notifications
- ✅ Session tracking and analytics
- ✅ Enterprise-grade security

---

## 📋 Prerequisites

Before starting, you need:

**Accounts:**
- GitHub account
- Railway account (hosting)
- Supabase account (database)
- Twilio account (TURN servers) OR use existing if you have
- SendGrid account (emails) OR use existing if you have
- AWS account (S3) OR Google Cloud (GCS) - for storage
- Sentry account (optional - error tracking)

**Local Tools:**
- Node.js 18+ installed
- Unity 2023+ installed
- Android SDK (for Quest builds)
- Git

**Time:** ~2-3 hours for complete setup

---

## 🚀 Step-by-Step Deployment

### Part 1: External Services Setup (60-90 minutes)

#### 1. Create Supabase Database (10 minutes)

**a) Sign up:**
1. Go to https://supabase.com
2. Create account (free tier works)
3. Create new project
   - Name: `vr-streaming`
   - Database password: (generate strong password)
   - Region: Choose closest to your users
4. Wait ~2 minutes for project creation

**b) Run database schema:**
1. In Supabase dashboard → SQL Editor
2. Open `WebappBackend/database/schema.sql` from this repo
3. Copy entire file contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify: Go to Table Editor → should see 3 tables:
   - `stream_sessions`
   - `stream_viewers`
   - `stream_recordings`

**c) Get credentials:**
1. Settings → API
2. Copy:
   - **Project URL:** `https://xxx.supabase.co`
   - **Anon/Public key:** `eyJxxx...`
3. Save these for later

---

#### 2. Set Up Storage (15-20 minutes)

**Option A: Google Cloud Storage (if you have GCP)**

1. Go to https://console.cloud.google.com
2. Create bucket:
   - Name: `your-app-vr-recordings`
   - Location: Regional (closest to users)
   - Storage class: Standard
3. Create service account:
   - IAM → Service Accounts → Create
   - Grant "Storage Admin" role
   - Create JSON key
4. Save JSON key file

**Option B: AWS S3**

1. Go to https://console.aws.amazon.com/s3
2. Create bucket:
   - Name: `your-app-vr-recordings` (must be globally unique)
   - Region: `us-east-1`
   - Uncheck "Block all public access" (or configure properly)
3. Create IAM user:
   - IAM → Users → Create user
   - Name: `vr-streaming-uploader`
   - Attach policy: `AmazonS3FullAccess`
   - Create access key
   - **Save Access Key ID and Secret Access Key**

---

#### 3. Set Up Twilio TURN Servers (10 minutes)

**a) Sign up:**
1. Go to https://www.twilio.com/try-twilio
2. Create account and verify email
3. **Upgrade to paid account** (TURN requires paid tier)

**b) Get credentials:**
1. Dashboard → Account Info
2. Copy:
   - **Account SID:** `ACxxx...`
   - **Auth Token:** `xxx...`

**c) Test (optional):**
```bash
npm install -g turn-test
turn-test turn:global.turn.twilio.com:3478 -u YOUR_SID -p YOUR_TOKEN
```

---

#### 4. Set Up SendGrid Email (10 minutes)

**a) Sign up:**
1. Go to https://sendgrid.com
2. Sign up (Free tier: 100 emails/day, or Essentials: $15/month)

**b) Create API key:**
1. Settings → API Keys → Create API Key
2. Name: `vr-streaming-notifications`
3. Permissions: Full Access
4. **Copy key immediately** (only shown once!)

**c) Verify sender email:**
1. Settings → Sender Authentication
2. Verify Single Sender
3. Use: `notifications@yourdomain.com`
4. Check email and click verification link

---

#### 5. Set Up Sentry (5 minutes - Optional)

1. Go to https://sentry.io
2. Create account (free tier works)
3. Create project → Node.js
4. Copy DSN: `https://xxx@xxx.ingest.sentry.io/xxx`

---

### Part 2: Deploy Backend to Railway (20-30 minutes)

#### 1. Prepare Repository

**Fork or clone this repository:**
```bash
git clone https://github.com/jlin3/substream-sdk.git
cd substream-sdk
```

**Or fork on GitHub and clone your fork.**

---

#### 2. Create Railway Project

**a) Sign up:**
1. Go to https://railway.app
2. Sign in with GitHub

**b) Create project:**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `substream-sdk` repository
4. Railway auto-detects Node.js project

---

#### 3. Configure Environment Variables

**In Railway dashboard → Variables tab, add ALL of these:**

```bash
# Server Configuration
NODE_ENV=production
PORT=443

# Security & Authentication
# IMPORTANT: Use the SAME JWT secret as your main app!
JWT_SECRET=your-main-app-jwt-secret-here
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database (from Part 1, Step 1)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# Storage - Option A: Google Cloud Storage
GCLOUD_STORAGE_BUCKET=your-app-vr-recordings
GCS_SIGNING_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GCP_JSON_CREDENTIALS=paste-entire-json-key-here

# Storage - Option B: AWS S3 (comment out GCS above if using this)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=AKIAxxx...
# AWS_SECRET_ACCESS_KEY=xxx...
# S3_BUCKET=your-app-vr-recordings

# TURN Servers (from Part 1, Step 3)
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...

# Email Notifications (from Part 1, Step 4)
SENDGRID_API_KEY=SG.xxx...
FROM_EMAIL=notifications@yourdomain.com

# Monitoring (from Part 1, Step 5 - optional)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# App Configuration
STREAM_VIEWER_URL=https://yourdomain.com
```

**⚠️ CRITICAL:**
- Use your **main app's JWT secret** for `JWT_SECRET`
- Update `ALLOWED_ORIGINS` with your actual domain
- Don't use example values - use real credentials

---

#### 4. Deploy

Railway auto-deploys when you push to main branch.

**a) Initial deployment:**
- Railway detects changes
- Builds automatically
- ~2-3 minutes

**b) Get deployment URL:**
- Railway provides: `https://your-app-xxx.up.railway.app`
- Copy this URL

**c) Test deployment:**
```bash
curl https://your-app-xxx.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "features": {
    "database": true,
    "storage": true,
    "notifications": true,
    "auth": true
  }
}
```

**All `true` = ✅ Successfully deployed!**

---

### Part 3: Configure Unity (15 minutes)

#### 1. Update Stream Settings

**Open Unity project:**

**File:** `Assets/Stream-Settings.asset`

Update WebSocket URL:
```yaml
m_url: wss://your-app-xxx.up.railway.app
```

Update TURN servers (use your Twilio credentials):
```yaml
m_iceServers:
  - m_urls:
    - stun:stun.l.google.com:19302
  - m_urls:
    - stun:global.stun.twilio.com:3478
  - m_urls:
    - turn:global.turn.twilio.com:3478?transport=udp
    - turn:global.turn.twilio.com:3478?transport=tcp
    - turn:global.turn.twilio.com:443?transport=tcp
    m_username: YOUR_TWILIO_ACCOUNT_SID
    m_credentialType: 0
    m_credential: YOUR_TWILIO_AUTH_TOKEN
```

#### 2. Configure RenderStreamControl

Find `RenderStreamControl` component in scene, update in Inspector:
- **Backend URL:** `https://your-app-xxx.up.railway.app`
- **Stream Bitrate:** 8000 (or lower for slower connections)
- **Stream Frame Rate:** 60 (or 30 for compatibility)

---

### Part 4: Build & Test (30 minutes)

#### 1. Test in Unity Editor (5 minutes)

**Quick test before building:**

1. Press Play in Unity
2. Press `L` key
3. Check console for:
   ```
   ✅ HIGH QUALITY: 1920x1080, 60fps, 6000-10000kbps bitrate
   ✅ WebRTC Connection STARTED
   ```

4. Open browser: `https://your-app-xxx.up.railway.app/receiver/`
5. Click Play
6. Should see Unity Editor view!

---

#### 2. Build for Quest (10 minutes)

**Build settings:**
1. File → Build Settings
2. Platform: Android
3. Player Settings → Other Settings:
   - **Minimum API Level:** Android 10.0 (API 29)
   - **Target API Level:** Android 13.0 (API 33)
   - **Scripting Backend:** IL2CPP
   - **ARM64:** ✅ Checked
4. Click "Build"
5. Wait ~5-10 minutes

---

#### 3. Install on Quest (5 minutes)

**Prerequisites:**
- Quest connected via USB
- Developer mode enabled on Quest
- ADB installed (`brew install android-platform-tools` on Mac)

**Install:**
```bash
adb install -r YourApp.apk

# Verify installation
adb shell pm list packages | grep your.app.package
```

---

#### 4. Test End-to-End (10 minutes)

**Step 1:** Open receiver page in browser
```
https://your-app-xxx.up.railway.app/receiver/
```

**Step 2:** Click "Play" button

**Step 3:** Put on Quest headset

**Step 4:** Launch your app

**Step 5:** Press streaming button

**Step 6:** Check browser - video should appear! 🎉

---

## 🔧 Configuration Reference

### Environment Variables Explained

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `NODE_ENV` | Yes | Environment | `production` |
| `PORT` | Yes | Server port | `443` |
| `JWT_SECRET` | Yes | Auth verification | Your app's JWT secret |
| `SUPABASE_URL` | Yes | Database | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Yes | Database auth | `eyJxxx...` |
| `TWILIO_ACCOUNT_SID` | Yes | TURN servers | `ACxxx...` |
| `TWILIO_AUTH_TOKEN` | Yes | TURN servers | `xxx...` |
| `SENDGRID_API_KEY` | Yes | Email notifications | `SG.xxx...` |
| `FROM_EMAIL` | Yes | Sender email | `notifications@yourdomain.com` |
| `ALLOWED_ORIGINS` | Yes | CORS security | `https://yourdomain.com` |
| `STREAM_VIEWER_URL` | Yes | For email links | `https://yourdomain.com` |
| `SENTRY_DSN` | No | Error tracking | `https://xxx@sentry.io/xxx` |
| `AWS_*` or `GCLOUD_*` | Yes | Storage | See above |

---

## 📊 Cost Breakdown

### One-Time Costs
- $0 (all services have free tiers or pay-as-you-go)

### Monthly Costs (Production)

**Minimum (Free tiers + basic):**
- Railway: $5-20
- Supabase: $0 (free tier)
- Twilio TURN: ~$50-100 (usage-based)
- SendGrid: $0-15
- Storage: ~$10-20
- Sentry: $0 (free tier)
- **Total: ~$65-155/month**

**Recommended (better reliability):**
- Railway Pro: $20-50
- Supabase Pro: $25
- Twilio TURN: $100-200
- SendGrid Essentials: $15-20
- Storage: $20-50
- Sentry: $26
- **Total: ~$206-371/month**

---

## 🧪 Testing Checklist

Before launching:

- [ ] Health check shows all features `true`
- [ ] Can create session via API (test with curl)
- [ ] Unity connects to backend
- [ ] WebRTC connection establishes
- [ ] Video streams to browser
- [ ] Recording uploads successfully
- [ ] Email notifications send
- [ ] Works on Quest headset
- [ ] Multiple viewers can watch simultaneously
- [ ] Quality is 1080p @ 60fps
- [ ] No errors in Sentry

---

## 🐛 Troubleshooting

### "Features: database: false"

**Problem:** Supabase credentials wrong or schema not run

**Fix:**
1. Verify `SUPABASE_URL` and `SUPABASE_KEY` in Railway
2. Run `database/schema.sql` in Supabase SQL Editor
3. Test connection: `curl https://your-supabase-url.co/rest/v1/ -H "apikey: YOUR_KEY"`

---

### "Features: storage: false"

**Problem:** Storage credentials missing or invalid

**Fix:**
1. Verify AWS or GCS credentials in Railway
2. Test bucket access
3. For GCS: Ensure service account has Storage Admin role
4. For S3: Ensure IAM user has S3 write permissions

---

### "Features: notifications: false"

**Problem:** SendGrid API key missing or invalid

**Fix:**
1. Verify `SENDGRID_API_KEY` in Railway
2. Verify sender email is verified in SendGrid
3. Test: `curl -X POST https://api.sendgrid.com/v3/mail/send -H "Authorization: Bearer YOUR_KEY"`

---

### "Unity can't connect to backend"

**Problem:** WebSocket URL wrong or firewall blocking

**Fix:**
1. Verify Unity `Stream-Settings.asset` has: `wss://your-railway-url.up.railway.app` (with `wss://` for production)
2. Check Railway logs for connection attempts
3. Verify CORS allows your domain

---

### "Recording upload fails"

**Problem:** File too large or storage credentials wrong

**Fix:**
1. Check Railway logs for upload errors
2. Verify storage credentials
3. Check file size (default limit: 500MB)
4. Test storage upload manually

---

## 🔄 CI/CD (Automatic Deployment)

Railway auto-deploys when you push to GitHub:

**Setup:**
1. Push changes to your GitHub repo
2. Railway detects changes
3. Auto-builds and deploys
4. Check deployment logs in Railway dashboard

**Rollback:**
1. Railway dashboard → Deployments
2. Click on previous successful deployment
3. Click "Redeploy"

---

## 🔐 Security Best Practices

### Required

- ✅ Use strong JWT_SECRET (min 32 characters)
- ✅ Set ALLOWED_ORIGINS to your domains only (not `*`)
- ✅ Use HTTPS/WSS in production (HTTP/WS only for local testing)
- ✅ Keep `.env` file in `.gitignore` (never commit credentials)
- ✅ Rotate credentials every 90 days
- ✅ Enable Railway's environment variable encryption

### Recommended

- ✅ Set up Railway alerts for errors
- ✅ Monitor Sentry for security issues
- ✅ Review Supabase audit logs
- ✅ Enable Railway's DDoS protection
- ✅ Use Railway's custom domains with SSL

---

## 📈 Monitoring & Maintenance

### Daily
- Check Railway logs for errors
- Monitor Sentry error rate
- Verify recordings uploading successfully

### Weekly
- Review storage usage (Supabase + S3/GCS)
- Check email delivery rate (SendGrid)
- Monitor Twilio TURN usage and costs
- Review active sessions in database

### Monthly
- Rotate API keys
- Review and optimize costs
- Update dependencies (`npm audit`)
- Check for Unity package updates

---

## 🚀 Going to Production

### Before Launch

1. **Set up custom domain:**
   - Railway → Settings → Domains
   - Add your domain: `streaming.yourdomain.com`
   - Update CORS and JWT settings

2. **Test with real users:**
   - Invite 5-10 beta testers
   - Monitor for issues
   - Gather feedback

3. **Load testing:**
   ```bash
   # Test with 10 concurrent streams
   artillery quick --count 10 -n 20 https://your-backend.com/api/sessions/active
   ```

4. **Security audit:**
   - Test auth bypass attempts
   - Verify CORS blocks unauthorized domains
   - Test rate limiting

5. **Backup database:**
   - Supabase has automatic backups
   - Verify you can restore

---

### Launch Day

1. **Deploy final version to Railway**
2. **Update Unity app with production URLs**
3. **Build and submit to Quest store** (or sideload)
4. **Monitor closely:**
   - Railway logs
   - Sentry errors
   - Database growth
   - Storage usage
   - Email delivery

---

## 📞 Support Resources

### Documentation
- `TESTING_NOW.md` - Quick local testing
- `docs/PRODUCTION_DEPLOYMENT.md` - Detailed deployment
- `docs/WEB_APP_INTEGRATION.md` - Frontend integration
- `docs/TURN_SERVER_SETUP.md` - TURN server details
- `docs/HIGH_QUALITY_RECORDING.md` - Recording quality guide

### Services
- Railway: https://docs.railway.app
- Supabase: https://supabase.com/docs
- Twilio: https://www.twilio.com/docs
- SendGrid: https://docs.sendgrid.com
- Sentry: https://docs.sentry.io

### Community
- GitHub Issues: Report bugs or ask questions
- Railway Discord: For deployment help
- Supabase Discord: For database help

---

## 🎯 Quick Start Summary

**Fastest path to deployment:**

```bash
# 1. Set up services (60-90 min)
- Supabase: 10 min
- Storage: 20 min
- Twilio: 10 min
- SendGrid: 10 min
- Sentry: 5 min

# 2. Deploy to Railway (30 min)
- Create project: 5 min
- Set environment variables: 15 min
- Deploy and test: 10 min

# 3. Configure Unity (15 min)
- Update URLs: 5 min
- Update TURN servers: 5 min
- Test in Editor: 5 min

# 4. Build and test on Quest (30 min)
- Build APK: 10 min
- Install on Quest: 5 min
- Test streaming: 15 min

# Total: ~2-3 hours
```

---

## ✅ Deployment Checklist

Print this and check off as you complete:

### Pre-Deployment
- [ ] Supabase project created
- [ ] Database schema executed
- [ ] Storage bucket created (S3 or GCS)
- [ ] Twilio account set up
- [ ] SendGrid account configured
- [ ] Sender email verified
- [ ] All credentials collected

### Railway Deployment
- [ ] Railway project created
- [ ] Repository connected
- [ ] All environment variables set
- [ ] Initial deployment successful
- [ ] Health check returns all `true`
- [ ] Custom domain configured (optional)

### Unity Configuration
- [ ] Stream-Settings.asset updated
- [ ] RenderStreamControl configured
- [ ] TURN servers configured
- [ ] Tested in Unity Editor
- [ ] Build for Quest successful

### Testing
- [ ] Local streaming works
- [ ] Quest streaming works
- [ ] Recording uploads to storage
- [ ] Session appears in database
- [ ] Email notifications send
- [ ] Multiple viewers work
- [ ] Quality is acceptable
- [ ] No errors in logs

### Production
- [ ] Beta tested with users
- [ ] Load tested
- [ ] Security audited
- [ ] Monitoring configured
- [ ] Documentation complete
- [ ] Support plan in place

---

## 🎉 You're Done!

Once all checkboxes are checked, you have a **production-ready VR streaming platform**!

**Cost:** $65-371/month depending on usage  
**Quality:** 1080p @ 60fps with 256kbps audio  
**Features:** Recording, notifications, analytics, security  

**Questions?** Check the docs/ folder for detailed guides on specific topics.

