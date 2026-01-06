# Create Your .env File - WebRTC Backend

This guide helps you create the `.env` file for the **WebRTC backend** (`WebappBackend/`).

> **Note**: If you're using the IVS streaming system, see `IVS_SETUP.md` in the repository root instead. This guide is for the WebRTC-based streaming approach.

## Quick Setup

### 1. Navigate to WebappBackend

```bash
cd WebappBackend
```

### 2. Create .env file

Copy and paste this template into a new `.env` file:

```bash
# ==============================================
# Server Configuration
# ==============================================
NODE_ENV=development
PORT=80

# ==============================================
# Database - Supabase
# ==============================================
# Create free account at https://supabase.com
# Go to Settings → API to get these values
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# ==============================================
# Authentication
# ==============================================
# Use a strong secret for JWT signing (32+ characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-jwt-secret-here

# ==============================================
# CORS - Allowed Origins
# ==============================================
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ==============================================
# TURN Servers - Twilio (Optional but Recommended)
# ==============================================
# Required for WebRTC connections through firewalls
# Sign up at https://www.twilio.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# ==============================================
# Email Notifications - SendGrid (Optional)
# ==============================================
# Sign up at https://sendgrid.com
SENDGRID_API_KEY=
FROM_EMAIL=notifications@yourdomain.com

# ==============================================
# Recording Storage (Optional)
# ==============================================
# Option A: Google Cloud Storage
GCLOUD_STORAGE_BUCKET=your-bucket-name
GCP_JSON_CREDENTIALS=

# Option B: AWS S3
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# S3_BUCKET=your-bucket-name

# ==============================================
# Monitoring - Sentry (Optional)
# ==============================================
SENTRY_DSN=

# ==============================================
# Stream Viewer URL (for notifications)
# ==============================================
STREAM_VIEWER_URL=http://localhost:3000
```

### 3. Fill in Required Values

At minimum, you need:

| Variable | How to Get |
|----------|------------|
| `SUPABASE_URL` | Supabase dashboard → Settings → API |
| `SUPABASE_KEY` | Supabase dashboard → Settings → API (anon key) |
| `JWT_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 4. Verify Configuration

Start the server and check the health endpoint:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then in another terminal:

```bash
curl http://localhost/health
```

Expected response:
```json
{
  "status": "ok",
  "features": {
    "database": true,
    "storage": false,
    "notifications": false,
    "auth": true
  }
}
```

Features show as `true` when the corresponding environment variables are configured.

---

## Setting Up External Services

### Supabase (Database)

1. Go to https://supabase.com
2. Create a new project (free tier works)
3. Wait for project creation (~2 minutes)
4. Go to Settings → API
5. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_KEY`
6. Run database schema:
   - Go to SQL Editor
   - Copy contents of `database/schema.sql`
   - Click "Run"

### Twilio (TURN Servers)

1. Go to https://www.twilio.com/try-twilio
2. Create account and verify
3. Go to Console → Account Info
4. Copy:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`

### SendGrid (Email)

1. Go to https://sendgrid.com
2. Create account (free tier: 100 emails/day)
3. Settings → API Keys → Create API Key
4. Copy the key → `SENDGRID_API_KEY`
5. Verify sender email in Sender Authentication

### Google Cloud Storage (Optional)

1. Go to https://console.cloud.google.com
2. Create or select a project
3. Create a storage bucket
4. Create a service account with Storage Admin role
5. Download JSON key
6. Set:
   - `GCLOUD_STORAGE_BUCKET` = bucket name
   - `GCP_JSON_CREDENTIALS` = entire JSON key contents

---

## What Each Variable Does

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Environment mode (development/production) |
| `PORT` | Server port (80 for development) |
| `SUPABASE_URL` | Database connection |
| `SUPABASE_KEY` | Database authentication |
| `JWT_SECRET` | Token signing for auth |
| `ALLOWED_ORIGINS` | CORS security |
| `TWILIO_*` | TURN servers for WebRTC |
| `SENDGRID_*` | Email notifications |
| `GCLOUD_*` or `AWS_*` | Recording storage |
| `SENTRY_DSN` | Error tracking |
| `STREAM_VIEWER_URL` | Links in notification emails |

---

## Troubleshooting

### "database: false" in health check

- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check if you ran `database/schema.sql`
- Test connection: `curl YOUR_SUPABASE_URL/rest/v1/ -H "apikey: YOUR_KEY"`

### "auth: false" in health check

- `JWT_SECRET` is missing or empty
- Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### File not found errors

- Make sure `.env` is in the `WebappBackend/` folder (not the root)
- File must be named exactly `.env` (not `.env.txt`)
- No extra spaces around `=` signs

### Server won't start

- Check if port 80 is in use: `lsof -i :80`
- Try a different port: `PORT=3001` in `.env`

---

## Next Steps

Once the backend is running:

1. Open `client/public/receiver/index.html` in browser
2. Click Play button
3. Open Unity → Play → Press `L` key
4. Video should stream!

For production deployment, see `docs/PRODUCTION_DEPLOYMENT.md`.
