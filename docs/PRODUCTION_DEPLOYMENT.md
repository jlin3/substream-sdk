# Production Deployment Guide

Complete guide for deploying Unity Render Streaming to production with all features.

## Prerequisites

Before deploying, you need accounts for:
- [ ] Supabase (database)
- [ ] AWS (S3 storage)
- [ ] Twilio (TURN servers)
- [ ] SendGrid (email notifications)
- [ ] Railway or AWS (hosting)
- [ ] Sentry (error tracking - optional)

---

## Step 1: Database Setup (Supabase)

### Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - Name: `vr-streaming-prod`
   - Database Password: (generate strong password)
   - Region: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### Run Database Schema

1. In Supabase dashboard, go to SQL Editor
2. Copy contents of `WebappBackend/database/schema.sql`
3. Paste and click "Run"
4. Verify tables were created (should see `stream_sessions`, `stream_viewers`, `stream_recordings`)

### Get Credentials

1. Go to Settings → API
2. Copy:
   - Project URL: `https://xxx.supabase.co`
   - Anon/Public key: `eyJxxx...`
3. Save these for environment variables

---

## Step 2: Storage Setup (AWS S3)

### Create S3 Bucket

1. Log into AWS Console
2. Go to S3 → Create bucket
3. Settings:
   - Bucket name: `vr-stream-recordings-prod` (must be globally unique)
   - Region: `us-east-1` (or your preferred region)
   - Block all public access: **OFF** (or configure properly)
   - Bucket Versioning: **Enabled** (recommended)

### Configure Bucket Policy

Go to Permissions → Bucket Policy, add:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::vr-stream-recordings-prod/*"
    }
  ]
}
```

### Create IAM User

1. Go to IAM → Users → Create user
2. User name: `vr-streaming-uploader`
3. Attach policy: `AmazonS3FullAccess` (or create custom policy with only upload permissions)
4. Create access key:
   - Use case: Application running outside AWS
   - Copy Access Key ID and Secret Access Key
5. Save these for environment variables

---

## Step 3: TURN Servers (Twilio)

### Sign Up for Twilio

1. Go to https://www.twilio.com/try-twilio
2. Sign up and verify your account
3. Upgrade to paid account (TURN requires paid account)

### Get Credentials

1. Go to Console Dashboard
2. Copy:
   - Account SID: `ACxxx...`
   - Auth Token: `xxx...`
3. TURN servers will be available at:
   - `turn:global.turn.twilio.com:3478?transport=udp`
   - `turn:global.turn.twilio.com:3478?transport=tcp`
   - `turn:global.turn.twilio.com:443?transport=tcp`

### Verify TURN Access

Test with this command:
```bash
npm install -g turn-test
turn-test turn:global.turn.twilio.com:3478 -u $TWILIO_ACCOUNT_SID -p $TWILIO_AUTH_TOKEN
```

---

## Step 4: Email Notifications (SendGrid)

### Create SendGrid Account

1. Go to https://sendgrid.com/pricing
2. Sign up for Free plan (100 emails/day) or Essentials
3. Verify your account (check email)

### Create API Key

1. Go to Settings → API Keys
2. Click "Create API Key"
3. Name: `vr-streaming-notifications`
4. Permissions: Full Access (or Restricted Access with Mail Send only)
5. Copy the API key (only shown once!)

### Verify Sender

1. Go to Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in your details (use your app's email)
4. Check email and click verification link
5. Use this email as `FROM_EMAIL` in environment variables

---

## Step 5: Deploy Backend (Railway)

### Create Railway Project

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `substream-sdk` repository
5. Select the `main` branch

### Configure Environment Variables

In Railway dashboard, go to Variables and add:

```bash
# Server
NODE_ENV=production
PORT=443

# Security (IMPORTANT - use your own values!)
JWT_SECRET=<your-main-app-jwt-secret>
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com

# Database (from Step 1)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# Storage (from Step 2)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxx...
AWS_SECRET_ACCESS_KEY=xxx...
S3_BUCKET=vr-stream-recordings-prod

# TURN Servers (from Step 3)
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...

# Notifications (from Step 4)
SENDGRID_API_KEY=SG.xxx...
FROM_EMAIL=notifications@yourapp.com

# Viewer URL (your main app)
STREAM_VIEWER_URL=https://yourapp.com

# Monitoring (optional)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Deploy

1. Railway will auto-deploy on push to main
2. Wait for build to complete (~2-3 minutes)
3. Get your deployment URL: `https://xxx.up.railway.app`
4. Test health check: `https://xxx.up.railway.app/health`

You should see:
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

---

## Step 6: Update Unity Configuration

### Update Stream Settings

Edit `UnityProject/Assets/Stream-Settings.asset`:

```yaml
m_url: wss://your-railway-url.up.railway.app

m_iceServers:
  - m_urls:
    - stun:stun.l.google.com:19302
  - m_urls:
    - stun:global.stun.twilio.com:3478
  - m_urls:
    - turn:global.turn.twilio.com:3478?transport=udp
    - turn:global.turn.twilio.com:3478?transport=tcp
    - turn:global.turn.twilio.com:443?transport=tcp
    m_username: <TWILIO_ACCOUNT_SID>
    m_credentialType: 0
    m_credential: <TWILIO_AUTH_TOKEN>
```

### Update RenderStreamControl Script

Add auth token handling (if not already present):

```csharp
// In RenderStreamControl.cs
private string authToken;
private string backendUrl = "https://your-railway-url.up.railway.app";

void Start() {
    // Get auth token from your app
    authToken = PlayerPrefs.GetString("AuthToken");
    // ... rest of setup
}
```

### Build and Deploy Unity App

1. Build for Android (Quest)
2. Test thoroughly before releasing
3. Deploy to Quest store or sideload

---

## Step 7: Integrate with Main Web App

### Add Stream Viewer Component

Example React component:

```tsx
// components/VRStreamViewer.tsx
import { useEffect, useState } from 'react';

export function VRStreamViewer({ sessionId, userToken }) {
  const [streamUrl, setStreamUrl] = useState('');
  
  useEffect(() => {
    // Build receiver URL with auth
    const url = `https://your-railway-url.up.railway.app/receiver?session=${sessionId}&token=${userToken}`;
    setStreamUrl(url);
  }, [sessionId, userToken]);
  
  return (
    <iframe
      src={streamUrl}
      style={{ width: '100%', height: '600px', border: 'none' }}
      allow="camera; microphone; autoplay; fullscreen"
    />
  );
}
```

### Add API Integration

```typescript
// api/streaming.ts
const API_BASE = 'https://your-railway-url.up.railway.app/api';

export async function getActiveStreams(authToken: string) {
  const response = await fetch(`${API_BASE}/sessions/active`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  return response.json();
}

export async function getSessionRecordings(sessionId: string, authToken: string) {
  const response = await fetch(`${API_BASE}/recordings/session/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  return response.json();
}
```

---

## Step 8: Testing

### Test Checklist

- [ ] Unity app connects to production backend
- [ ] WebSocket authentication works
- [ ] Stream starts and creates database session
- [ ] Parent receives email notification
- [ ] Multiple viewers can watch stream
- [ ] Recording starts automatically
- [ ] Recording uploads to S3
- [ ] Parent receives recording notification
- [ ] Stream quality is 1080p @ 30fps
- [ ] Works on Quest headset
- [ ] Error tracking works (check Sentry)

### Load Testing

Test with multiple concurrent streams:

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 10 -n 20 https://your-railway-url.up.railway.app/api/sessions/active
```

---

## Step 9: Monitoring

### Set Up Alerts

1. **Railway**: Enable deployment notifications
2. **Sentry**: Set up error alerts
3. **AWS CloudWatch**: Monitor S3 usage
4. **SendGrid**: Monitor email delivery rates

### Monitor Metrics

Daily checks:
- [ ] Check Railway logs for errors
- [ ] Monitor S3 storage usage
- [ ] Review Sentry error reports
- [ ] Check email delivery success rate
- [ ] Monitor active stream count

---

## Cost Breakdown (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Railway | Pro | $20-50 |
| Supabase | Free/Pro | $0-25 |
| AWS S3 | Pay-as-you-go | $20-50 |
| Twilio TURN | Pay-as-you-go | $100-200 |
| SendGrid | Essentials | $15-20 |
| Sentry | Developer | $0-26 |
| **Total** | | **$155-371/month** |

---

## Troubleshooting

### Backend won't start
- Check all environment variables are set
- Verify Supabase credentials
- Check Railway logs

### WebSocket connection fails
- Verify JWT_SECRET matches main app
- Check ALLOWED_ORIGINS includes your domain
- Test with Postman/curl

### Recording upload fails
- Verify AWS credentials
- Check S3 bucket permissions
- Monitor file sizes (max 500MB per chunk)

### Email notifications not sending
- Verify SendGrid API key
- Check sender email is verified
- Check SendGrid activity logs

---

## Security Best Practices

1. **Never commit `.env` file** - use `.gitignore`
2. **Rotate credentials regularly** (every 90 days)
3. **Use strong JWT_SECRET** (min 32 characters)
4. **Enable HTTPS only** in production
5. **Monitor failed auth attempts**
6. **Keep dependencies updated** (`npm audit`)
7. **Backup database** regularly (Supabase auto-backups)

---

## Rollback Plan

If deployment fails:

1. **Railway**: Click "Rollback" in deployment history
2. **Unity**: Keep previous APK version
3. **Database**: Supabase has automatic backups

---

## Next Steps

After successful deployment:

1. Monitor for 24-48 hours
2. Gather user feedback
3. Optimize based on usage patterns
4. Plan scaling if needed
5. Document any issues/solutions

---

## Support

For issues:
- Check Railway logs
- Review Sentry errors
- Check Supabase SQL logs
- Monitor SendGrid activity

Need help? Review the main documentation or check service-specific docs.

