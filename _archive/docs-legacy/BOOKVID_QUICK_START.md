# BookVid VR Streaming - Quick Start Guide

## 🎉 Great News: You Already Have Everything!

Your existing BookVid infrastructure has:
- ✅ Twilio (TURN servers)
- ✅ SendGrid (emails)  
- ✅ Sentry (error tracking)
- ✅ **LiveKit (fully configured!)** 🎯
- ✅ Google Cloud Storage

**Cost of adding VR streaming: $0-25/month** (just database, everything else you already pay for!)

---

## 🔥 RECOMMENDED: Test LiveKit First (2-3 hours)

Since you already have LiveKit configured, test it immediately:

### Step 1: Clone LiveKit Test Repo (2 min)

```bash
cd ~/
git clone https://github.com/jlin3/livekit-vr-test.git
cd livekit-vr-test
```

### Step 2: Configure Backend (1 min)

Create `backend/.env`:

```bash
PORT=3001

# Your existing LiveKit credentials (use values from your main app's .env)
LIVEKIT_URL=<your-livekit-url>
LIVEKIT_API_KEY=<your-livekit-api-key>
LIVEKIT_API_SECRET=<your-livekit-api-secret>
```

### Step 3: Start Backend (2 min)

```bash
cd backend
npm install
npm run dev
```

Should see:
```
🚀 LiveKit Test Server running!
   Port: 3001
   LiveKit URL: wss://bookvid-j3bmelo3.livekit.cloud
   Has Credentials: true
```

### Step 4: Test Web Viewer (1 min)

Open `viewer/index.html` in browser - should see the viewer interface.

### Step 5: Add to Unity (10 min)

1. Open your Unity project
2. Install LiveKit Unity SDK:
   - Window → Package Manager
   - `+` → Add package from git URL
   - `https://github.com/livekit/client-sdk-unity.git`

3. Copy `unity-setup/LiveKitTest.cs` to your Unity project

4. Add to a GameObject, configure:
   - Backend URL: `http://localhost:3001`
   - User ID: `test-user-1`

5. Press Play → Press `L` → Should start streaming!

### Step 6: Watch Stream (1 min)

1. Copy room name from Unity console
2. In browser viewer, paste room name
3. Click "Connect"
4. **You should see VR stream!** 🎉

**Total time: 15-20 minutes to working prototype**

---

## If LiveKit Works (Recommended Path)

### Week 1: Production LiveKit Backend (3-5 days)

Since all infrastructure exists, you just need to:

1. **Create Supabase project** for session tracking (30 min)
2. **Update LiveKit backend** with your credentials (30 min)
3. **Add parent notification integration** (1-2 days)
4. **Deploy to Railway** (30 min)
5. **Test end-to-end** (1 day)

**Total: 3-5 days to production** instead of 3 weeks!

### Benefits:
- ✅ Recording already works (your bucket configured)
- ✅ No new monthly costs (you pay for LiveKit already)
- ✅ Much simpler code (~300 lines vs 1400+)
- ✅ Proven technology
- ✅ Faster to market

---

## If You Stick with Unity Render Streaming

### Use Your Existing Services

Update backend configuration to use:

**JWT:** Your existing `SECRET_KEY` (copy from main app .env)
```bash
JWT_SECRET=<your-existing-secret-key>
```

**TURN:** Your existing Twilio (copy from main app .env)
```bash
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
```

**Email:** Your existing SendGrid (copy from main app .env)
```bash
SENDGRID_API_KEY=<your-sendgrid-key>
FROM_EMAIL=notifications@bookvid.com
```

**Storage:** Use GCS instead of S3 (copy from main app .env)
```bash
GCLOUD_STORAGE_BUCKET=bookvid-prod-vr-recordings
GCS_SIGNING_SERVICE_ACCOUNT_EMAIL=<your-gcs-service-account-email>
```

I've created `WebappBackend/src/services/storage-gcs.ts` - use this instead of the S3 version.

---

## 💰 Updated Cost Analysis

### LiveKit Path:
- LiveKit: **Already paying** ✅
- Supabase: $0-25/month (or use MySQL)
- Railway: $20-50/month
- **Total NEW cost: $20-75/month**

### Unity Render Streaming Path:
- Twilio: **Already paying** ✅
- SendGrid: **Already paying** ✅
- Sentry: **Already paying** ✅
- Supabase: $0-25/month
- Railway: $20-50/month
- **Total NEW cost: $20-75/month**

**Either way, you save $100-300/month** by using existing services!

---

## 🎯 My Recommendation

**Test LiveKit this week** (15 minutes of work):

1. Use credentials above
2. Test in Unity Editor
3. If it works → save 2 weeks of development
4. If not → continue with Unity Render Streaming (still cheaper using your existing services)

**No downside to testing - takes 15 minutes!**

---

## 📋 Immediate Next Steps

### Option 1: Test LiveKit Now (15 min)

```bash
cd ~/livekit-vr-test/backend
# Create .env with your LiveKit credentials (see above)
npm install && npm run dev
# Open viewer/index.html
# Test in Unity
```

### Option 2: Deploy Unity Render Streaming (follow original plan)

```bash
cd ~/substream-sdk/WebappBackend
# Create .env with your credentials (see BOOKVID_PRODUCTION_CONFIG.md)
# Use storage-gcs.ts instead of storage.ts
npm install && npm run dev
```

**I recommend Option 1 first - takes 15 minutes to validate!**

---

## Questions?

1. **Should I update the Unity Render Streaming backend** to use GCS instead of S3?
2. **Should I create a LiveKit integration guide** using your existing setup?
3. **Both?**

Let me know and I'll help you deploy whichever path you choose! 🚀

