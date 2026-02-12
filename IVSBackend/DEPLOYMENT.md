# IVS Backend Deployment Guide

> **FOR SUBSTREAM OPERATORS ONLY**
>
> This guide is for deploying the IVS backend to provide demo credentials to SDK users.

---

## Quick Deploy to Railway

### 1. Prerequisites

- [Railway account](https://railway.app)
- AWS account with IVS configured (see [IVS_BACKEND_SETUP.md](../IVS_BACKEND_SETUP.md))
- PostgreSQL database (Railway provides this, or use Supabase)

### 2. Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Link to this directory
cd IVSBackend
railway link

# Deploy
railway up
```

### 3. Configure Environment Variables

In the Railway dashboard, add these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJal...` |
| `IVS_RECORDING_CONFIG_ARN` | Recording config ARN | `arn:aws:ivs:...` |
| `IVS_PLAYBACK_KEY_PAIR_ID` | Playback key pair ID | `arn:aws:ivs:...` |
| `IVS_PLAYBACK_PRIVATE_KEY` | EC private key (P-384) | `-----BEGIN EC PRIVATE KEY-----...` |
| `STREAM_KEY_ENCRYPTION_KEY` | 32-byte hex key | Generate with `openssl rand -hex 32` |
| `NODE_ENV` | Environment | `production` |

### 4. Set Up Database

```bash
# Run migrations
railway run pnpm db:push

# Seed demo data
railway run pnpm db:seed
```

### 5. Verify Deployment

```bash
# Get your Railway URL
railway status

# Test health endpoint
curl https://your-app.up.railway.app/api/health

# Test demo credentials
curl -X POST https://your-app.up.railway.app/api/streams/children/demo-child-001/ingest \
  -H "Authorization: Bearer demo-token"
```

---

## Deploy Web Viewer (Optional)

The web viewer can be deployed as a static site:

### Railway (Static)

```bash
cd examples/web-viewer
railway init
railway up
```

### Vercel

```bash
cd examples/web-viewer
npx vercel
```

### GitHub Pages

1. Push `examples/web-viewer/` to a GitHub repo
2. Enable GitHub Pages in repo settings
3. Set source to the `examples/web-viewer` folder

---

## Update Documentation

After deployment, update these files with your actual URLs:

### 1. SDK_STREAMING_GUIDE.md

Replace placeholder URLs:
```markdown
| Demo API | `https://YOUR-RAILWAY-URL.up.railway.app` |
| Demo Viewer | `https://YOUR-VIEWER-URL` |
```

### 2. examples/web-viewer/index.html

Update default values:
```javascript
value="https://YOUR-RAILWAY-URL.up.railway.app"
```

### 3. README.md

Update quick start section with actual demo URL.

---

## Demo Credentials

After running `pnpm db:seed`, these credentials are available:

### For SDK Users (Streaming)

| Setting | Value |
|---------|-------|
| API Endpoint | `https://YOUR-RAILWAY-URL.up.railway.app` |
| Child ID | `demo-child-001` |
| Auth Token | `demo-token` |

### For Viewers (Watching)

| Setting | Value |
|---------|-------|
| API Endpoint | `https://YOUR-RAILWAY-URL.up.railway.app` |
| Child ID | `demo-child-001` |
| Auth Token | `demo-viewer-token` |

---

## Monitoring

### Health Check

The `/api/health` endpoint returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Logs

```bash
# View Railway logs
railway logs

# Follow logs
railway logs -f
```

### Database

```bash
# Open Prisma Studio
railway run pnpm db:studio
```

---

## Troubleshooting

### "Database connection failed"

- Check `DATABASE_URL` is correct
- Ensure database allows connections from Railway IPs
- For Supabase: Use the "Connection pooling" URL

### "AWS credentials invalid"

- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Check IAM user has `AmazonIVSFullAccess` policy
- Ensure region matches your IVS resources

### "IVS channel creation failed"

- Verify `IVS_RECORDING_CONFIG_ARN` exists in the same region
- Check IVS service quotas in AWS console
- Ensure S3 bucket for recordings exists

### "Playback token generation failed"

- Verify `IVS_PLAYBACK_KEY_PAIR_ID` is correct
- Check `IVS_PLAYBACK_PRIVATE_KEY` includes full PEM (with newlines)
- For Railway, use `\n` for newlines in the key

---

## Cost Estimates

### Railway
- Hobby plan: $5/month (sufficient for demo)
- Pro plan: $20/month (for production)

### AWS IVS
- Basic channel: ~$0.20/hour of streaming
- S3 storage: ~$0.023/GB

### Total Demo Cost
- ~$10-20/month for light demo usage

---

## Security Notes

1. **Demo credentials are public** - Don't use for sensitive data
2. **Rate limiting** - Consider adding rate limiting for demo endpoint
3. **Monitoring** - Watch for abuse of demo credentials
4. **Rotation** - Rotate AWS credentials periodically
