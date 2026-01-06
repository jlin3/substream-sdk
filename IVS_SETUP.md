# IVS Streaming Setup Guide

This guide walks you through setting up the AWS IVS (Amazon Interactive Video Service) streaming system for Unity VR applications.

## Overview

The IVS streaming system uses RTMPS protocol to stream from Unity to AWS IVS, providing:
- **2-5 second latency** (vs sub-second with WebRTC)
- **Automatic recording** to S3
- **Scalable infrastructure** managed by AWS
- **VOD playback** of recorded streams

```
┌─────────────────┐     RTMPS      ┌─────────────────┐
│   Unity Game    │ ─────────────> │  AWS IVS        │
│  (IVSStream-    │                │  Channel        │
│   Control.cs)   │                └────────┬────────┘
└─────────────────┘                         │
                                   Auto-Record to S3
                                            │
                                            v
┌─────────────────┐     HLS        ┌─────────────────┐
│  Web Viewer     │ <───────────── │   S3 Bucket     │
│  (IVS Player)   │                │  (VOD Storage)  │
└─────────────────┘                └─────────────────┘
```

---

## Quick Start (For Developers)

If you just want to test the system and the project owner has already set up AWS IVS:

### 1. Get Test Credentials

Contact the project owner (Jesse) to get these credentials securely:

| Credential | Description |
|------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_ACCESS_KEY_ID` | AWS IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM credentials |
| `IVS_RECORDING_CONFIG_ARN` | Recording configuration ARN |
| `IVS_PLAYBACK_KEY_PAIR_ID` | Playback key pair ARN |
| `IVS_PLAYBACK_PRIVATE_KEY` | EC private key (PEM format) |

### 2. Set Up Backend

```bash
# Navigate to the IVS backend
cd IVSBackend

# Install dependencies
pnpm install

# Copy environment template
cp env.example.txt .env

# Edit .env with credentials from Jesse
nano .env

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Start the server
pnpm dev
```

The backend will start at http://localhost:3000

### 3. Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Get ingest credentials (replace child-id with test user)
curl -X POST http://localhost:3000/api/streams/children/test-child-id/ingest \
  -H "Authorization: Bearer test-user-id" \
  -H "Content-Type: application/json"
```

### 4. Configure Unity

1. Open the Unity project in `UnityProject/`
2. Open your streaming scene
3. Add `IVSStreamControl` component to a GameObject
4. Configure in Inspector:
   - **Backend URL**: `http://localhost:3000`
   - **Child ID**: Your test child ID
   - **Auth Token**: Your test auth token

### 5. Test Streaming

1. Press Play in Unity Editor
2. Press `U` to start streaming
3. Check Console for:
   ```
   [IVS] Got ingest config: arn:aws:ivs:...
   [IVS] RTMP URL: rtmps://xxx.global-contribute.live-video.net:443/app/
   ```

**Note**: Without the native FFmpeg library, you'll see stub output. The API calls work, but actual RTMPS streaming requires building the native library.

---

## Full Setup (Self-Hosting)

If you need to set up your own AWS IVS infrastructure:

### Phase 1: AWS Setup (1-2 hours)

#### 1. Create S3 Bucket for Recordings

```bash
# Create bucket (name must be globally unique)
aws s3 mb s3://your-ivs-recordings-bucket --region us-east-1

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket your-ivs-recordings-bucket \
  --versioning-configuration Status=Enabled
```

#### 2. Create Recording Configuration

```bash
aws ivs create-recording-configuration \
  --name "stream-recording" \
  --destination-configuration s3={bucketName=your-ivs-recordings-bucket} \
  --thumbnail-configuration recordingMode=INTERVAL,targetIntervalSeconds=60
```

Save the returned `arn` as `IVS_RECORDING_CONFIG_ARN`.

#### 3. Create Playback Key Pair

```bash
# Generate an EC key pair (P-384 curve required)
openssl ecparam -name secp384r1 -genkey -noout -out private-key.pem
openssl ec -in private-key.pem -pubout -out public-key.pem

# Import into IVS
aws ivs import-playback-key-pair \
  --public-key-material file://public-key.pem \
  --name "stream-playback"
```

Save:
- The returned `arn` as `IVS_PLAYBACK_KEY_PAIR_ID`
- Contents of `private-key.pem` as `IVS_PLAYBACK_PRIVATE_KEY`

#### 4. Create IAM User

Create an IAM user with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivs:CreateChannel",
        "ivs:DeleteChannel",
        "ivs:GetChannel",
        "ivs:ListChannels",
        "ivs:CreateStreamKey",
        "ivs:GetStreamKey",
        "ivs:ListStreamKeys",
        "ivs:DeleteStreamKey",
        "ivs:GetStream",
        "ivs:ListStreams",
        "ivs:StopStream"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-ivs-recordings-bucket",
        "arn:aws:s3:::your-ivs-recordings-bucket/*"
      ]
    }
  ]
}
```

Save the Access Key ID and Secret as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### Phase 2: Database Setup (15 minutes)

#### Option A: Supabase (Recommended)

1. Create free account at https://supabase.com
2. Create new project
3. Go to Settings → Database → Connection string
4. Copy as `DATABASE_URL`

#### Option B: Local PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb substream
```

Set `DATABASE_URL=postgresql://localhost:5432/substream`

### Phase 3: Backend Setup (10 minutes)

```bash
cd IVSBackend

# Install dependencies
pnpm install

# Create .env file with all your credentials
cp env.example.txt .env
nano .env

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start server
pnpm dev
```

### Phase 4: Unity Setup (5 minutes)

See the Unity configuration section above.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AWS_REGION` | Yes | AWS region (e.g., `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `IVS_RECORDING_CONFIG_ARN` | Yes | Recording configuration ARN |
| `IVS_PLAYBACK_KEY_PAIR_ID` | Yes | Playback key pair ARN |
| `IVS_PLAYBACK_PRIVATE_KEY` | Yes | EC private key (PEM) |
| `STREAM_KEY_ENCRYPTION_KEY` | Prod | 32-byte hex encryption key |
| `NODE_ENV` | No | `development` or `production` |

---

## API Reference

### Get Ingest Credentials

```
POST /api/streams/children/:childId/ingest
Authorization: Bearer <token>

Response:
{
  "channelArn": "arn:aws:ivs:...",
  "ingest": {
    "protocol": "rtmps",
    "endpoint": "rtmps://xxx.global-contribute.live-video.net:443/app/",
    "streamKey": "sk_us-east-1_..."
  },
  "recommendedEncoderConfig": {
    "maxWidth": 1280,
    "maxHeight": 720,
    "maxFramerate": 30,
    "maxBitrateKbps": 3500,
    "keyframeIntervalSeconds": 2
  }
}
```

### Create Session

```
POST /api/streams/children/:childId/sessions
Authorization: Bearer <token>

Response:
{
  "sessionId": "uuid"
}
```

### End Session

```
DELETE /api/streams/sessions/:sessionId
Authorization: Bearer <token>

Response:
{
  "success": true
}
```

### Get Playback URL

```
GET /api/streams/children/:childId/playback
Authorization: Bearer <token>

Response:
{
  "childId": "uuid",
  "channelArn": "arn:aws:ivs:...",
  "playback": {
    "url": "https://xxx.playback.live-video.net/...",
    "token": "eyJhbGciOi...",
    "expiresAt": "2024-01-01T12:00:00Z"
  },
  "status": {
    "isLive": true,
    "currentSessionId": "uuid"
  }
}
```

---

## Troubleshooting

### "Failed to get streaming credentials"

- Check backend is running (`pnpm dev`)
- Verify API endpoint is accessible
- Check childId matches a user in the database

### "Failed to create session"

- Check database connection
- Verify child profile exists
- Ensure no active session exists

### "FFmpeg not available"

The stub publisher is active - this means:
- API calls work fine
- No actual RTMPS streaming occurs
- Build native FFmpeg library for real streaming

### Native Library Not Loading

- Check library is in correct `Plugins/` folder
- Verify Unity import settings
- On macOS: Check Security & Privacy for blocked library
- Restart Unity after adding plugins

---

## Testing Without Native Library

You can test the full pipeline using OBS or FFmpeg:

```bash
# Get credentials from API
curl -X POST http://localhost:3000/api/streams/children/test-child/ingest \
  -H "Authorization: Bearer test-user"

# Use returned credentials with FFmpeg
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:sample_rate=44100 \
  -c:v libx264 -preset veryfast -b:v 3500k \
  -g 60 -keyint_min 60 \
  -c:a aac -b:a 128k \
  -f flv "rtmps://ENDPOINT:443/app/STREAM_KEY"
```

---

## What's Already Implemented

### Unity (No Developer Action Needed)

- `IVSStreamControl.cs` - Full IVS streaming component
- `NativeFFmpegBridge.cs` - Native library interface
- `FFmpegRTMPPublisher.cs` - RTMP streaming wrapper
- Stub publisher for testing without native library

### Backend (No Developer Action Needed)

- All API routes for ingest/playback/sessions
- Prisma database schema
- IVS channel management
- Stream key encryption
- Playback token generation

### What You May Need to Do

- Build native FFmpeg library for production (see `UnityProject/Plugins/README.md`)
- Set up AWS IVS (if self-hosting)
- Configure `.env` with credentials

---

## Next Steps

1. Set up backend with test credentials
2. Test API endpoints
3. Run Unity and verify stub publisher logs
4. (Optional) Build native FFmpeg for real streaming
5. (Optional) Deploy backend to production

---

## Resources

- [AWS IVS Documentation](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/)
- [IVS Player SDK](https://docs.aws.amazon.com/ivs/latest/userguide/player.html)
- [Unity Project README](UnityProject/Plugins/README.md)
