# TURN Server Setup Guide

TURN servers are critical for establishing WebRTC connections when direct peer-to-peer connections fail (due to NAT/firewalls).

## Option 1: Twilio (Recommended for Production)

### Why Twilio?
- Global coverage with low latency
- Pay-as-you-go pricing
- 99.95% uptime SLA
- Easy integration
- No server management

### Cost
- $0.40 per GB transferred
- Typical 1080p stream @ 30fps ≈ 2-4GB/hour
- 100 hours of streaming ≈ $80-160/month

### Setup Steps

#### 1. Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up and verify your email
3. Upgrade to paid account (TURN requires paid tier)

#### 2. Get Credentials
1. Go to Console Dashboard
2. Copy your **Account SID**: `ACxxxxxxxxxxxxx`
3. Copy your **Auth Token**: `xxxxxxxxxxxxxx`
4. Save these securely

#### 3. Update Unity Configuration

Edit `UnityProject/Assets/Stream-Settings.asset`:

```yaml
m_iceServers:
  # Keep existing STUN server
  - m_urls:
    - stun:stun.l.google.com:19302
    m_username: 
    m_credentialType: 0
    m_credential: 
  
  # Add Twilio STUN servers
  - m_urls:
    - stun:global.stun.twilio.com:3478
    m_username: 
    m_credentialType: 0
    m_credential: 
  
  # Add Twilio TURN servers (CRITICAL)
  - m_urls:
    - turn:global.turn.twilio.com:3478?transport=udp
    - turn:global.turn.twilio.com:3478?transport=tcp
    - turn:global.turn.twilio.com:443?transport=tcp
    m_username: YOUR_TWILIO_ACCOUNT_SID
    m_credentialType: 0
    m_credential: YOUR_TWILIO_AUTH_TOKEN
```

**Important:** Replace `YOUR_TWILIO_ACCOUNT_SID` and `YOUR_TWILIO_AUTH_TOKEN` with your actual credentials.

#### 4. Test TURN Servers

Use the TURN test tool:

```bash
npm install -g turn-test

turn-test turn:global.turn.twilio.com:3478 \
  -u YOUR_ACCOUNT_SID \
  -p YOUR_AUTH_TOKEN
```

Should output: `TURN server works!`

---

## Option 2: Free TURN Servers (Development Only)

Already configured in your setup:

```yaml
m_iceServers:
  - m_urls:
    - turn:openrelay.metered.ca:80
    - turn:openrelay.metered.ca:443
    - turn:openrelay.metered.ca:443?transport=tcp
    m_username: openrelayproject
    m_credentialType: 0
    m_credential: openrelayproject
```

**⚠️ NOT for production:**
- Rate limited
- No SLA
- Can be slow
- May block your app

---

## Option 3: Self-Hosted Coturn (Advanced)

For maximum control and potentially lower cost at scale.

### Requirements
- AWS EC2 or DigitalOcean Droplet
- Ubuntu 22.04
- Public IP address
- 2GB RAM minimum

### Installation

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Coturn
sudo apt-get install -y coturn

# Enable coturn service
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

### Configuration

Edit `/etc/turnserver.conf`:

```conf
# Basic settings
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=YOUR_SERVER_PUBLIC_IP
external-ip=YOUR_SERVER_PUBLIC_IP/YOUR_SERVER_PRIVATE_IP

# Realm and server name
realm=turn.yourdomain.com
server-name=turn.yourdomain.com

# Authentication
use-auth-secret
static-auth-secret=GENERATE_RANDOM_SECRET_HERE

# Relay addresses
min-port=49152
max-port=65535

# Performance
total-quota=100
max-bps=3000000
user-quota=50
bps-capacity=0

# Security
no-multicast-peers
no-cli
fingerprint

# Logging
log-file=/var/log/turnserver/turnserver.log
verbose

# SSL certificates (if using TLS)
# cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
# pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

### Generate Auth Secret

```bash
openssl rand -hex 32
```

### Start Coturn

```bash
# Create log directory
sudo mkdir -p /var/log/turnserver
sudo chown turnserver:turnserver /var/log/turnserver

# Start service
sudo systemctl start coturn
sudo systemctl enable coturn

# Check status
sudo systemctl status coturn

# View logs
sudo tail -f /var/log/turnserver/turnserver.log
```

### Firewall Rules

```bash
# Allow TURN ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
sudo ufw allow 49152:65535/tcp
```

### Unity Configuration

```yaml
m_iceServers:
  - m_urls:
    - turn:YOUR_SERVER_IP:3478?transport=udp
    - turn:YOUR_SERVER_IP:3478?transport=tcp
    - turns:turn.yourdomain.com:5349?transport=tcp
    m_username: anyusername
    m_credentialType: 0
    m_credential: YOUR_STATIC_AUTH_SECRET
```

### Cost Estimate
- EC2 t3.medium: $30/month
- Bandwidth: $0.09/GB (AWS)
- Total: ~$50-100/month

---

## Comparison

| Feature | Twilio | Free | Self-Hosted |
|---------|--------|------|-------------|
| **Setup** | 5 minutes | Done | 2-3 hours |
| **Cost** | $80-200/month | Free | $50-100/month |
| **Reliability** | 99.95% | Poor | 99.5% |
| **Latency** | Low | Variable | Low |
| **Maintenance** | None | None | Regular updates |
| **Scaling** | Automatic | Limited | Manual |

## Recommendation

**For your 3-week timeline and "whatever it takes" budget:**

Use **Twilio** because:
- ✅ 5-minute setup
- ✅ No maintenance
- ✅ Proven reliability
- ✅ Scales automatically
- ✅ Global coverage
- ✅ Cost is reasonable ($100-200/month)

---

## Testing TURN Servers

### From Browser Console

```javascript
// Test TURN server connectivity
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=udp',
      username: 'YOUR_ACCOUNT_SID',
      credential: 'YOUR_AUTH_TOKEN'
    }
  ]
});

pc.createDataChannel('test');
pc.createOffer().then(offer => pc.setLocalOffer(offer));

pc.onicecandidate = (e) => {
  if (e.candidate) {
    console.log('ICE Candidate:', e.candidate.candidate);
    if (e.candidate.candidate.includes('relay')) {
      console.log('✅ TURN server working!');
    }
  }
};
```

### From Unity

Add temporary test code:

```csharp
void TestTurnServers()
{
    // Check SignalingManager ICE servers
    var iceServers = signalingManager.GetIceServers();
    foreach (var server in iceServers)
    {
        Debug.Log($"ICE Server: {string.Join(", ", server.urls)}");
        Debug.Log($"  Username: {server.username}");
        Debug.Log($"  Has Credential: {!string.IsNullOrEmpty(server.credential)}");
    }
}
```

---

## Troubleshooting

### Connection still fails with TURN
- Verify username/credential are correct
- Check firewall allows UDP ports
- Try TCP transport as fallback
- Test with turn-test tool
- Check Twilio usage logs

### High TURN usage costs
- Optimize video bitrate (reduce from 3000 to 2000 kbps)
- Reduce frame rate (30fps → 24fps)
- Use STUN where possible (direct connection)
- Monitor usage in Twilio console

### Latency issues
- Use TURN server closest to users
- Prefer UDP over TCP when possible
- Monitor network quality
- Consider regional TURN servers

---

## Next Steps

1. ✅ Sign up for Twilio (or chosen service)
2. ✅ Get credentials
3. ✅ Update Unity Stream-Settings.asset
4. ✅ Test connection
5. ✅ Monitor usage and costs
6. ✅ Optimize based on metrics

