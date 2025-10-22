# Deployment Guide

## Quick Deploy Options

### Option 1: Railway (Easiest)

**Pros:** Zero config, automatic HTTPS, simple scaling
**Cons:** Can get expensive at scale
**Cost:** ~$5-50/month depending on usage

#### Steps:
1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `WebappBackend` as root directory
5. Set environment variables:
   ```
   PORT=80
   TYPE=websocket
   MODE=public
   ```
6. Railway will auto-detect Node.js and deploy

#### Build Configuration:
```json
// railway.json (create in WebappBackend/)
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Option 2: AWS (Production Ready)

**Pros:** Scalable, reliable, full control
**Cons:** More complex setup
**Cost:** ~$50-200/month

#### Architecture:
```
Users → CloudFront → ALB → ECS Fargate → Redis
                     ↓
                   TURN Servers (EC2)
```

#### Steps:

**1. Backend (ECS Fargate):**
```bash
# Build Docker image
cd WebappBackend
docker build -t substream-backend .

# Push to ECR
aws ecr create-repository --repository-name substream-backend
docker tag substream-backend:latest {account}.dkr.ecr.us-east-1.amazonaws.com/substream-backend:latest
docker push {account}.dkr.ecr.us-east-1.amazonaws.com/substream-backend:latest

# Create ECS service
aws ecs create-cluster --cluster-name substream-cluster
# ... (see AWS docs for full ECS setup)
```

**2. TURN Servers (EC2):**
```bash
# Launch EC2 instance (t3.medium)
# Install Coturn
sudo apt-get update
sudo apt-get install coturn

# Configure coturn
sudo nano /etc/turnserver.conf
```

**Coturn Config:**
```conf
listening-port=3478
tls-listening-port=5349
external-ip={YOUR_EC2_PUBLIC_IP}
realm=your-domain.com
server-name=turn.your-domain.com

# Authentication
use-auth-secret
static-auth-secret={GENERATE_RANDOM_SECRET}

# Limits
total-quota=100
max-bps=3000000

# Logging
log-file=/var/log/turnserver.log
verbose
```

**3. Load Balancer:**
```yaml
# ALB Configuration
Type: Application Load Balancer
Protocol: HTTP/HTTPS
Health Check: /config
Sticky Sessions: Enabled (for WebSocket)
```

**4. Redis (ElastiCache):**
```bash
# Create Redis cluster for session storage
aws elasticache create-cache-cluster \
  --cache-cluster-id substream-sessions \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1
```

### Option 3: DigitalOcean (Good Middle Ground)

**Pros:** Simpler than AWS, more control than Railway
**Cons:** Less features than AWS
**Cost:** ~$30-100/month

#### Steps:
1. Create Droplet (Ubuntu 22.04, 2GB RAM)
2. Install Node.js and PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

3. Deploy app:
```bash
git clone https://github.com/your-repo/substream-sdk.git
cd substream-sdk/WebappBackend
npm install
npm run build

# Start with PM2
pm2 start build/index.js --name substream-backend
pm2 startup
pm2 save
```

4. Install Nginx as reverse proxy:
```nginx
# /etc/nginx/sites-available/substream
upstream backend {
    server 127.0.0.1:80;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 4: Vercel/Netlify (Frontend Only)

For hosting the receiver web app separately from backend.

**Vercel:**
```bash
cd WebappBackend/client/public
vercel deploy
```

**Netlify:**
```bash
# netlify.toml in client/public/
[build]
  publish = "."
```

## TURN Server Options

### Option 1: Twilio (Managed)
```javascript
// Get ICE servers from Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const token = await client.tokens.create();
// Use token.iceServers in Unity config
```
**Cost:** $0.40/GB, $0.005/min

### Option 2: Xirsys (Managed)
```bash
curl -X PUT https://global.xirsys.net/_turn/your-channel \
  -u "username:credential"
```
**Cost:** $50-200/month

### Option 3: Self-Hosted Coturn

See AWS Option 2 above for setup.
**Cost:** EC2 instance (~$20-50/month)

## Environment Variables

### Development (.env.development)
```bash
NODE_ENV=development
PORT=80
TYPE=websocket
MODE=public
LOGGING=dev

# TURN servers (use free ones for dev)
TURN_URL=turn:openrelay.metered.ca:80
TURN_USERNAME=openrelayproject
TURN_PASSWORD=openrelayproject
```

### Production (.env.production)
```bash
NODE_ENV=production
PORT=80
TYPE=websocket
MODE=public
LOGGING=combined

# Your dedicated TURN servers
TURN_URL=turn:turn.your-domain.com:3478
TURN_USERNAME=${TURN_USERNAME}
TURN_PASSWORD=${TURN_SECRET}

# Database
DATABASE_URL=postgresql://user:pass@host:5432/substream
REDIS_URL=redis://user:pass@host:6379

# Monitoring
SENTRY_DSN=https://...
DATADOG_API_KEY=...

# Auth
JWT_SECRET=${JWT_SECRET}
```

## Database Setup

### PostgreSQL Schema
```sql
-- Sessions table
CREATE TABLE stream_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    game_id VARCHAR(255),
    connection_id VARCHAR(255),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    viewer_count INTEGER DEFAULT 0,
    metadata JSONB
);

-- Viewers table
CREATE TABLE stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES stream_sessions(id),
    user_id VARCHAR(255),
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP
);

-- Analytics table
CREATE TABLE stream_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES stream_sessions(id),
    timestamp TIMESTAMP DEFAULT NOW(),
    event_type VARCHAR(50),
    data JSONB
);

-- Indexes
CREATE INDEX idx_sessions_user ON stream_sessions(user_id);
CREATE INDEX idx_sessions_active ON stream_sessions(ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_viewers_session ON stream_viewers(session_id);
```

## Monitoring Setup

### Datadog
```javascript
// In server.ts
const tracer = require('dd-trace').init({
  hostname: 'substream-backend',
  env: process.env.NODE_ENV
});

// Track metrics
const StatsD = require('node-dogstatsd').StatsD;
const dogstatsd = new StatsD();

// Track connections
dogstatsd.increment('stream.connections.started');
dogstatsd.gauge('stream.connections.active', activeConnections);
```

### CloudWatch (AWS)
```javascript
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

async function logMetric(metricName, value) {
  await cloudwatch.putMetricData({
    Namespace: 'Substream',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Timestamp: new Date()
    }]
  }).promise();
}
```

## SSL Certificates

### Let's Encrypt (Free)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### AWS Certificate Manager
```bash
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS \
  --subject-alternative-names www.your-domain.com
```

## CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build
        working-directory: ./WebappBackend
        run: |
          npm install
          npm run build
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## Health Checks

### Endpoint
```typescript
// In server.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    activeConnections: getActiveConnectionCount()
  });
});
```

### Monitoring
```bash
# Set up health check monitoring
curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -d "api_key=YOUR_KEY" \
  -d "friendly_name=Substream Backend" \
  -d "url=https://your-domain.com/health" \
  -d "type=1"
```

## Scaling Considerations

### Horizontal Scaling
```yaml
# docker-compose.yml for multi-instance
version: '3'
services:
  backend:
    image: substream-backend
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379
  
  redis:
    image: redis:alpine
  
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
```

### Load Balancing
```nginx
# Nginx load balancer config
upstream backend {
    ip_hash;  # Sticky sessions for WebSocket
    server backend-1:80;
    server backend-2:80;
    server backend-3:80;
}
```

## Rollback Plan

```bash
# Keep last 3 deployments
pm2 deploy production revert 1  # Rollback to previous
pm2 deploy production revert 2  # Rollback 2 versions

# Docker rollback
docker tag substream-backend:latest substream-backend:rollback
docker pull substream-backend:v1.2.3
docker tag substream-backend:v1.2.3 substream-backend:latest
```

## Testing Production

```bash
# Test WebSocket connection
wscat -c wss://your-domain.com/signaling

# Test TURN servers
npm install -g turn-test
turn-test turn:your-turn-server.com:3478 -u username -p password

# Load testing
artillery quick --count 100 -n 20 https://your-domain.com/config
```

