# Environment Configuration

Create a `.env` file in the `WebappBackend` directory with the following variables:

## Required Configuration

```bash
# Server Configuration
NODE_ENV=production
PORT=443

# Security & Authentication
JWT_SECRET=your-jwt-secret-from-main-app
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Storage (AWS S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET=vr-stream-recordings

# TURN Servers (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Notifications (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=notifications@yourapp.com

# Stream Viewer URL (for notification links)
STREAM_VIEWER_URL=https://yourapp.com

# Monitoring (Sentry - Optional)
SENTRY_DSN=your-sentry-dsn
```

## Development Configuration

For local development, use:

```bash
NODE_ENV=development
PORT=80
JWT_SECRET=dev-secret-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Leave other services empty for development
# The app will still work but with limited features
```

## Setup Instructions

### 1. Supabase Database

1. Go to https://supabase.com
2. Create a new project
3. Copy the URL and anon key from Settings → API
4. Run the SQL schema (see `database/schema.sql`)

### 2. AWS S3

1. Create an S3 bucket for recordings
2. Configure bucket policy for public read access (or use presigned URLs)
3. Create an IAM user with S3 upload permissions
4. Copy access key and secret

### 3. Twilio TURN Servers

1. Sign up at https://www.twilio.com
2. Get Account SID and Auth Token from console
3. Enable STUN/TURN service

### 4. SendGrid Email

1. Sign up at https://sendgrid.com
2. Create an API key with email sending permissions
3. Verify sender email address

### 5. Sentry (Optional)

1. Sign up at https://sentry.io
2. Create a new project
3. Copy the DSN from project settings

## Verifying Configuration

After setting up your `.env` file, start the server and visit:

```
http://localhost/health
```

You should see which features are enabled:

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

