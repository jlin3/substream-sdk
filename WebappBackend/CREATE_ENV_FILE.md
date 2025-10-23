# Create Your .env File - Exact Copy-Paste Instructions

## Step-by-Step Instructions

### 1. Open Terminal in WebappBackend folder

```bash
cd /Users/jesselinson/substream-sdk/WebappBackend
```

### 2. Create .env file

Copy and paste this ENTIRE block into your terminal:

```bash
cat > .env << 'EOF'
# ==========================================
# Server Configuration
# ==========================================
NODE_ENV=development
PORT=80

# ==========================================
# Database - Supabase (READY TO USE ✅)
# ==========================================
SUPABASE_URL=https://kxysgyvqguanyigtttaq.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eXNneXZxZ3VhbnlpZ3R0dGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjM4NzYsImV4cCI6MjA3NjczOTg3Nn0.C53OUkB76_SwXIAurfbb2gWxY02Y-fPUUwrAnI9AXR8

# ==========================================
# COPY FROM YOUR MAIN BOOKVID .env FILE:
# Open your main BookVid app's .env and copy the exact values for:
# - SECRET_KEY → paste as JWT_SECRET
# - TWILIO_ACCOUNT_SID → paste as is
# - TWILIO_AUTH_TOKEN → paste as is
# - SENDGRID_API_KEY → paste as is
# - SENTRY_DSN → paste as is
# - GCP_JSON_CREDENTIALS → paste as is
# ==========================================
JWT_SECRET=PASTE_YOUR_SECRET_KEY_HERE
TWILIO_ACCOUNT_SID=PASTE_YOUR_TWILIO_SID_HERE
TWILIO_AUTH_TOKEN=PASTE_YOUR_TWILIO_TOKEN_HERE
SENDGRID_API_KEY=PASTE_YOUR_SENDGRID_KEY_HERE
SENTRY_DSN=PASTE_YOUR_SENTRY_DSN_HERE
GCP_JSON_CREDENTIALS=PASTE_YOUR_GCP_CREDENTIALS_HERE

# ==========================================
# BookVid Configuration (READY TO USE ✅)
# ==========================================
FROM_EMAIL=notifications@bookvid.com
GCLOUD_STORAGE_BUCKET=bookvid-prod-vr-recordings
STREAM_VIEWER_URL=https://bookvid.com
ALLOWED_ORIGINS=https://bookvid.com,https://www.bookvid.com,http://localhost:3000,http://localhost:3001
EOF
```

### 3. Edit the .env file to add your actual credentials

```bash
nano .env
```

Or open in any text editor and replace these placeholders:
- `PASTE_YOUR_SECRET_KEY_HERE` → Copy `SECRET_KEY` value from main app
- `PASTE_YOUR_TWILIO_SID_HERE` → Copy `TWILIO_ACCOUNT_SID` from main app
- `PASTE_YOUR_TWILIO_TOKEN_HERE` → Copy `TWILIO_AUTH_TOKEN` from main app
- `PASTE_YOUR_SENDGRID_KEY_HERE` → Copy `SENDGRID_API_KEY` from main app
- `PASTE_YOUR_SENTRY_DSN_HERE` → Copy `SENTRY_DSN` from main app
- `PASTE_YOUR_GCP_CREDENTIALS_HERE` → Copy `GCP_JSON_CREDENTIALS` from main app

Save and close.

### 4. Verify .env file

```bash
cat .env | grep -v "^#" | grep -v "^$"
```

Should show all values filled in (not PASTE_YOUR_xxx anymore).

---

## Alternative: Manual Creation

If you prefer, create the file manually:

**File location:** `/Users/jesselinson/substream-sdk/WebappBackend/.env`

**File contents:** (copy this entire block, then replace the PASTE_YOUR_xxx values)

```
NODE_ENV=development
PORT=80

SUPABASE_URL=https://kxysgyvqguanyigtttaq.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eXNneXZxZ3VhbnlpZ3R0dGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjM4NzYsImV4cCI6MjA3NjczOTg3Nn0.C53OUkB76_SwXIAurfbb2gWxY02Y-fPUUwrAnI9AXR8

JWT_SECRET=PASTE_YOUR_SECRET_KEY_HERE
TWILIO_ACCOUNT_SID=PASTE_YOUR_TWILIO_SID_HERE
TWILIO_AUTH_TOKEN=PASTE_YOUR_TWILIO_TOKEN_HERE
SENDGRID_API_KEY=PASTE_YOUR_SENDGRID_KEY_HERE
SENTRY_DSN=PASTE_YOUR_SENTRY_DSN_HERE
GCP_JSON_CREDENTIALS=PASTE_YOUR_GCP_CREDENTIALS_HERE

FROM_EMAIL=notifications@bookvid.com
GCLOUD_STORAGE_BUCKET=bookvid-prod-vr-recordings
STREAM_VIEWER_URL=https://bookvid.com
ALLOWED_ORIGINS=https://bookvid.com,https://www.bookvid.com,http://localhost:3000,http://localhost:3001
```

Then edit and replace the `PASTE_YOUR_xxx` placeholders with values from your main BookVid .env file.

---

## What Each Variable Does

| Variable | Source | Purpose |
|----------|--------|---------|
| `SUPABASE_URL` | ✅ Ready | Database for sessions |
| `SUPABASE_KEY` | ✅ Ready | Database auth |
| `JWT_SECRET` | Copy `SECRET_KEY` | Verify auth tokens |
| `TWILIO_ACCOUNT_SID` | Copy from main | TURN servers |
| `TWILIO_AUTH_TOKEN` | Copy from main | TURN servers |
| `SENDGRID_API_KEY` | Copy from main | Email notifications |
| `SENTRY_DSN` | Copy from main | Error tracking |
| `GCP_JSON_CREDENTIALS` | Copy from main | Recording storage |

---

## Validation

After creating .env file, test it:

```bash
cd /Users/jesselinson/substream-sdk/WebappBackend
npm install
npm run dev
```

Then in another terminal:

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

All `true` = ✅ Ready to test!

---

## If You Get "Storage: false"

That's OK for initial testing. Recording will work when you add `GCP_JSON_CREDENTIALS`.

Everything else will work fine:
- Streaming ✅
- Session tracking ✅
- Emails ✅
- Authentication ✅

---

## Next: Test Streaming

Once .env is created and backend is running:

1. Open `client/public/receiver/index.html` in browser
2. Click Play button
3. Open Unity → Play → Press `L`
4. Video should stream! 🎉

---

## Need Help?

If .env file doesn't work:
- Make sure it's named exactly `.env` (not `.env.txt`)
- Make sure it's in `WebappBackend/` folder
- Check no extra spaces in values
- Verify you copied full values from main app

