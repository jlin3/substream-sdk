# Production Setup Checklist

Complete checklist for deploying to production in 3 weeks.

---

## ✅ Week 1: Backend Infrastructure (COMPLETE)

All code has been implemented. Now you need to configure external services:

### 1. Database Setup (30 minutes)

- [ ] **Sign up for Supabase**
  - Go to https://supabase.com
  - Create account
  - Create new project: `vr-streaming-prod`
  - Wait for provisioning (~2 minutes)

- [ ] **Run Database Schema**
  - Open Supabase dashboard → SQL Editor
  - Copy contents of `WebappBackend/database/schema.sql`
  - Paste and click "Run"
  - Verify tables created successfully

- [ ] **Get Credentials**
  - Go to Settings → API
  - Copy Project URL: `https://xxx.supabase.co`
  - Copy Anon Key: `eyJxxx...`
  - Save for environment variables

### 2. Storage Setup (20 minutes)

- [ ] **Create AWS Account** (if not already)
  - Go to https://aws.amazon.com
  - Sign up and verify

- [ ] **Create S3 Bucket**
  - Go to S3 → Create bucket
  - Name: `vr-stream-recordings-prod` (must be unique)
  - Region: `us-east-1`
  - Uncheck "Block all public access" (or configure properly)
  - Enable versioning
  - Create bucket

- [ ] **Create IAM User**
  - Go to IAM → Users → Create user
  - Name: `vr-streaming-uploader`
  - Attach policy: `AmazonS3FullAccess`
  - Create access key (Application running outside AWS)
  - **Save Access Key ID and Secret immediately!**

### 3. TURN Servers (15 minutes)

- [ ] **Sign up for Twilio**
  - Go to https://www.twilio.com/try-twilio
  - Create account and verify email
  - Upgrade to paid account (required for TURN)

- [ ] **Get Credentials**
  - Dashboard → Account Info
  - Copy Account SID: `ACxxx...`
  - Copy Auth Token: `xxx...`
  - Save for Unity config

- [ ] **Test TURN Server**
  ```bash
  npm install -g turn-test
  turn-test turn:global.turn.twilio.com:3478 -u ACCOUNT_SID -p AUTH_TOKEN
  ```
  - Should output: "TURN server works!"

### 4. Email Notifications (15 minutes)

- [ ] **Sign up for SendGrid**
  - Go to https://sendgrid.com
  - Sign up for Free plan (100 emails/day) or Essentials
  - Verify email address

- [ ] **Create API Key**
  - Settings → API Keys → Create API Key
  - Name: `vr-streaming-notifications`
  - Permissions: Full Access
  - **Copy key immediately!** (only shown once)

- [ ] **Verify Sender Email**
  - Settings → Sender Authentication
  - Verify single sender
  - Use: `notifications@yourdomain.com`
  - Check email and click verification link

### 5. Error Tracking (10 minutes - Optional)

- [ ] **Sign up for Sentry**
  - Go to https://sentry.io
  - Create account
  - Create new project (Node.js)
  - Copy DSN: `https://xxx@xxx.ingest.sentry.io/xxx`

---

## 🔄 Week 2: Configuration & Unity Updates

### 6. Deploy Backend to Railway (30 minutes)

- [ ] **Create Railway Account**
  - Go to https://railway.app
  - Sign in with GitHub

- [ ] **Create New Project**
  - New Project → Deploy from GitHub repo
  - Select `substream-sdk` repository
  - Wait for detection

- [ ] **Configure Environment Variables**
  
  Go to project → Variables, add all from `WebappBackend/ENV_CONFIG.md`:
  
  ```bash
  NODE_ENV=production
  PORT=443
  JWT_SECRET=(your main app's JWT secret)
  ALLOWED_ORIGINS=https://yourapp.com
  SUPABASE_URL=(from step 1)
  SUPABASE_KEY=(from step 1)
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=(from step 2)
  AWS_SECRET_ACCESS_KEY=(from step 2)
  S3_BUCKET=vr-stream-recordings-prod
  TWILIO_ACCOUNT_SID=(from step 3)
  TWILIO_AUTH_TOKEN=(from step 3)
  SENDGRID_API_KEY=(from step 4)
  FROM_EMAIL=notifications@yourdomain.com
  STREAM_VIEWER_URL=https://yourapp.com
  SENTRY_DSN=(from step 5 - optional)
  ```

- [ ] **Deploy**
  - Railway auto-deploys
  - Wait for build (~2-3 minutes)
  - Get deployment URL: `https://xxx.up.railway.app`

- [ ] **Test Deployment**
  ```bash
  curl https://your-railway-url.up.railway.app/health
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

### 7. Update Unity Configuration (15 minutes)

- [ ] **Update Stream Settings**
  
  Edit `UnityProject/Assets/Stream-Settings.asset` in Unity Editor:
  
  - WebSocket URL: `wss://your-railway-url.up.railway.app`
  - Add Twilio TURN servers (see `docs/TURN_SERVER_SETUP.md`)

- [ ] **Configure RenderStreamControl**
  
  In Unity Inspector:
  - Backend URL: `https://your-railway-url.up.railway.app`
  - Auth Token: (leave empty, will be set via PlayerPrefs)

### 8. Test Unity Integration (1-2 hours)

- [ ] **Set Test Auth Token**
  ```csharp
  // In Unity, run once to set token
  PlayerPrefs.SetString("AuthToken", "your-test-jwt-token");
  PlayerPrefs.Save();
  ```

- [ ] **Test in Unity Editor**
  - Press Play
  - Press `L` to start streaming
  - Check console for:
    - ✅ "Stream session created: {id}"
    - ✅ "WebRTC Connection STARTED"
  - Check Railway logs for session creation

- [ ] **Build for Quest**
  - Build APK
  - Install on Quest
  - Test streaming
  - Check logs via `adb logcat -s Unity`

---

## 🚀 Week 3: Final Integration & Launch

### 9. Web App Integration (2-3 days)

- [ ] **Create Stream Viewer Component**
  - Use examples from `docs/WEB_APP_INTEGRATION.md`
  - Test with iframe first (simplest)
  - Then native integration if needed

- [ ] **Add Stream Discovery Page**
  - List active streams
  - Display streamer info
  - "Watch Live" buttons

- [ ] **Add Recordings Page**
  - List past sessions
  - Display recordings
  - Download/playback functionality

### 10. Parent Notification Setup (1 day)

- [ ] **Connect to User Database**
  - Decide: shared DB or API calls?
  - Implement `getParentEmail(userId)` function
  - Test getting parent email

- [ ] **Update Session Routes**
  - Uncomment notification code in `sessions.ts`
  - Add parent email lookup
  - Test email sending

- [ ] **Test Notification Flow**
  - Start stream from Unity
  - Verify parent receives email
  - Click link in email
  - Verify viewer page opens

### 11. End-to-End Testing (2-3 days)

- [ ] **Unity → Backend → Database**
  - Start stream
  - Verify session created in Supabase
  - Check all fields populated

- [ ] **WebRTC Connection**
  - Unity sends video/audio
  - Browser receives video/audio
  - Quality is 1080p @ 30fps
  - TURN servers used when needed

- [ ] **Recording**
  - Stream for 2-3 minutes
  - Stop stream
  - Verify recording uploaded to S3
  - Check file size reasonable
  - Verify playable in browser

- [ ] **Notifications**
  - Parent receives "stream started" email
  - Email has correct link
  - Parent receives "recording ready" email
  - Links work correctly

- [ ] **Multi-Viewer**
  - Open 3+ browser tabs
  - All receive stream
  - Recording still works
  - Performance acceptable

- [ ] **Security**
  - Try accessing without token (should fail)
  - Try accessing other user's session (should fail)
  - Verify CORS blocks unauthorized domains

### 12. Load Testing (1 day)

- [ ] **Test Concurrent Streams**
  - Start 10+ streams simultaneously
  - Monitor backend performance
  - Check database queries
  - Verify no errors in Sentry

- [ ] **Test Many Viewers**
  - 20+ viewers on one stream
  - Check video quality
  - Monitor bandwidth usage
  - Verify recording still works

- [ ] **Stress Test**
  ```bash
  artillery quick --count 50 -n 10 https://your-backend.up.railway.app/api/sessions/active
  ```

### 13. Documentation (1 day)

- [ ] **API Documentation**
  - Document all endpoints
  - Add request/response examples
  - Authentication requirements

- [ ] **User Guide**
  - How to start streaming
  - How to watch streams
  - How to access recordings

- [ ] **Admin Guide**
  - Monitoring dashboards
  - Common issues
  - Maintenance tasks

---

## 📊 Progress Tracking

### Week 1 Status: ✅ COMPLETE
- ✅ Database schema
- ✅ Authentication system
- ✅ API routes (sessions, recordings)
- ✅ Storage service (S3)
- ✅ Notification service (SendGrid)
- ✅ Recording system (browser)
- ✅ Security (CORS, rate limiting)
- ✅ Monitoring (Sentry, metrics)

### Week 2 Status: 🔄 IN PROGRESS
- ⏳ External service setup (Supabase, AWS, Twilio, SendGrid)
- ⏳ Backend deployment to Railway
- ⏳ Unity configuration updates
- ⏳ Unity testing

### Week 3 Status: ⏳ PENDING
- ⏳ Web app integration
- ⏳ Parent notification hookup
- ⏳ End-to-end testing
- ⏳ Load testing
- ⏳ Documentation

---

## 🎯 Daily Checklist

Print this out and check off tasks daily:

**Day 6 (Monday):**
- [ ] Create all external accounts (Supabase, AWS, Twilio, SendGrid)
- [ ] Run database schema
- [ ] Deploy to Railway
- [ ] Test /health endpoint

**Day 7 (Tuesday):**
- [ ] Update Unity settings
- [ ] Test Unity Editor streaming
- [ ] Build for Quest
- [ ] Test on Quest headset

**Day 8 (Wednesday):**
- [ ] Create web viewer component
- [ ] Integrate with main app
- [ ] Test iframe embed

**Day 9 (Thursday):**
- [ ] Connect parent notification system
- [ ] Test email delivery
- [ ] Fix any integration issues

**Day 10 (Friday):**
- [ ] End-to-end testing
- [ ] Fix bugs
- [ ] Performance testing

**Week 3:**
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation
- [ ] Soft launch
- [ ] Monitor and fix issues

---

## 🆘 Getting Help

If stuck:
1. Check `docs/PRODUCTION_DEPLOYMENT.md` for detailed guides
2. Check `docs/WEB_APP_INTEGRATION.md` for integration examples
3. Check `docs/TURN_SERVER_SETUP.md` for TURN issues
4. Review Railway logs
5. Check Sentry errors
6. Test `/health` endpoint to see what's misconfigured

---

## ✅ Definition of Done

Project is production-ready when:

- ✅ All external services configured
- ✅ Backend deployed with all features enabled
- ✅ Unity app authenticates and creates sessions
- ✅ Streams work reliably on Quest
- ✅ Recording automatically uploads
- ✅ Parents receive notifications
- ✅ Web app can display streams
- ✅ Multiple viewers supported
- ✅ Load tested (10+ concurrent streams)
- ✅ Documentation complete
- ✅ Monitoring active

**Status: ~40% complete (Week 1 done, Weeks 2-3 remaining)**

**Next action:** Complete Week 2 setup tasks above!

