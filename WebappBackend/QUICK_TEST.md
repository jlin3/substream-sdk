# Quick Test Guide - You're Ready to Go!

## ✅ What You Have

- ✅ Supabase database: `https://kxysgyvqguanyigtttaq.supabase.co`
- ✅ Twilio (from BookVid)
- ✅ SendGrid (from BookVid)
- ✅ Sentry (from BookVid)
- ✅ Google Cloud Storage (from BookVid)
- ✅ All code implemented

**You can test in 5 minutes!**

---

## 🚀 Quick Test (5 minutes)

### Step 1: Run Database Schema

1. Go to https://kxysgyvqguanyigtttaq.supabase.co
2. Click "SQL Editor"
3. Copy entire contents of `database/schema.sql`
4. Paste and click "Run"
5. Should see: "Success. No rows returned"

### Step 2: Create .env File

In `WebappBackend/` folder, create a file named `.env`:

```bash
# Copy this entire block:

NODE_ENV=development
PORT=80

# Your Supabase (READY ✅)
SUPABASE_URL=https://kxysgyvqguanyigtttaq.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eXNneXZxZ3VhbnlpZ3R0dGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjM4NzYsImV4cCI6MjA3NjczOTg3Nn0.C53OUkB76_SwXIAurfbb2gWxY02Y-fPUUwrAnI9AXR8

# Copy from your main BookVid .env file:
JWT_SECRET=<copy-from-main-env>
TWILIO_ACCOUNT_SID=<copy-from-main-env>
TWILIO_AUTH_TOKEN=<copy-from-main-env>
SENDGRID_API_KEY=<copy-from-main-env>
SENTRY_DSN=<copy-from-main-env>
GCP_JSON_CREDENTIALS=<copy-from-main-env>

# BookVid config
FROM_EMAIL=notifications@bookvid.com
GCLOUD_STORAGE_BUCKET=bookvid-prod-vr-recordings
STREAM_VIEWER_URL=https://bookvid.com
ALLOWED_ORIGINS=https://bookvid.com,https://www.bookvid.com,http://localhost:3000
```

### Step 3: Start Backend

```bash
cd WebappBackend
npm install
npm run dev
```

Should see:
```
🚀 LiveKit Test Server running!
   Port: 80
```

### Step 4: Test Health Check

```bash
curl http://localhost/health
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

### Step 5: Test Streaming

1. Open `client/public/receiver/index.html` in browser
2. Click "Play" button
3. Open Unity → Press Play
4. Press `L` key to start streaming
5. Video should appear in browser! 🎉

---

## 🧪 Test API Endpoints

### Generate Test JWT

You'll need a JWT token from your main BookVid app. For testing, you can generate one:

```bash
# Install jwt-cli
npm install -g jsonwebtoken-cli

# Generate test token (expires in 24 hours)
jwt sign '{"sub":"test-user-123","email":"test@bookvid.com","role":"user"}' <your-jwt-secret>
```

Or use your existing BookVid auth system to get a real token.

### Test Session Creation

```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -X POST http://localhost/api/sessions/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "test-conn-123"}'
```

Should return:
```json
{
  "sessionId": "uuid-here",
  "roomName": "stream-test-user-123-xxx",
  "connectionId": "test-conn-123"
}
```

### Check Database

Go to Supabase dashboard → Table Editor → `stream_sessions`

You should see the session you just created!

---

## 🎯 Next: Deploy to Production

Once local testing works:

### 1. Deploy to Railway (30 min)

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `substream-sdk` repo
4. Add environment variables (same as .env but with production values)
5. Deploy!

### 2. Update Unity (5 min)

Edit `Stream-Settings.asset`:
- WebSocket URL: `wss://your-railway-url.up.railway.app`
- Add Twilio TURN servers (see `docs/TURN_SERVER_SETUP.md`)

### 3. Test End-to-End

- Build Unity for Quest
- Start streaming
- Watch in browser
- Check Supabase for session record
- Verify recording works

---

## 🐛 Troubleshooting

### "Database features: false"

The `.env` file isn't loaded or Supabase credentials wrong.

Check:
```bash
cat .env | grep SUPABASE
```

### "Cannot connect to Supabase"

Run the schema first! Go to Supabase SQL Editor and run `database/schema.sql`

### "Recording upload fails"

Need to configure GCS credentials. For now, recording will fail gracefully - streaming still works.

### "Unity session creation fails"

Need to set auth token in Unity:
```csharp
PlayerPrefs.SetString("AuthToken", "your-jwt-token");
```

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ `/health` shows all features true
2. ✅ Can create session via API
3. ✅ Session appears in Supabase
4. ✅ Unity streams to browser
5. ✅ Quality is good (1080p, 30fps)

---

## 💡 Quick Win: Try LiveKit Too

While you're testing, also try:

```bash
cd ~/livekit-vr-test/backend
# Create .env with your LiveKit credentials
npm install && npm run dev
```

Compare both approaches - you might prefer LiveKit since it's already configured!

---

## 📞 Next Steps

1. **Right now:** Create `.env` file with config above
2. **Then:** Run database schema in Supabase
3. **Then:** Test locally (5 min)
4. **Then:** Deploy to Railway (30 min)
5. **Then:** Test with Ben on Quest

**You're literally 10 minutes away from a working test!** 🚀

