# Substream SDK Documentation

## Overview

This SDK enables real-time VR game streaming from Unity to web browsers using WebRTC. Stream video, audio, and game data with low latency.

## Quick Links

- [Production Checklist](./production-checklist.md) - Complete list of what's needed for production
- [Web App Integration](./integration-example.md) - How to embed streams in your web app
- [Game Data Channels](./data-channel-guide.md) - Send real-time game state to web viewers

## Current Architecture

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   Unity VR      │ ─────── Signaling ────────▶│  Web Browser     │
│   (Quest)       │                             │  (Viewer)        │
│                 │◀─────── WebRTC ────────────▶│                  │
│  - Video 1080p  │      Video/Audio/Data       │  - React App     │
│  - Audio        │                             │  - Game Overlay  │
│  - Game Data    │         TURN Relay          │  - Controls      │
└─────────────────┘◀──────────┬────────────────▶└──────────────────┘
                              │
                     ┌────────┴─────────┐
                     │  TURN Server     │
                     │  (NAT Traversal) │
                     └──────────────────┘
```

## What You Have Now ✅

- ✅ Unity VR streaming (1080p @ 30fps)
- ✅ WebSocket signaling server
- ✅ Browser receiver client
- ✅ Basic WebRTC connection
- ✅ TURN servers configured
- ✅ Connection state logging

## What's Missing for Production ⚠️

### Critical (Must Have)
1. **Authentication** - Currently anyone can stream/view
2. **Dedicated TURN servers** - Free ones are unreliable
3. **Error handling** - Better recovery from failures
4. **Monitoring** - Track connection success, latency, etc.

### Important (Should Have)
5. **Stream discovery** - List active streams
6. **Session management** - Track who's streaming
7. **Reconnection logic** - Auto-reconnect on disconnect
8. **Quality controls** - Let users choose video quality

### Nice to Have
9. **Recording** - Save streams for replay
10. **Chat/interaction** - Let viewers interact
11. **Analytics** - Usage tracking
12. **Mobile support** - Optimized for mobile viewers

## Getting Started

### 1. Test Current Setup

**Backend:**
```bash
cd WebappBackend
npm install
npm run build
npm start
```

**Receiver Page:**
Open `http://localhost/receiver/` in browser

**Unity:**
1. Build and deploy to Quest
2. Start streaming in-game
3. Video should appear in browser

### 2. Integration Into Your Web App

See [integration-example.md](./integration-example.md) for:
- React component example
- API endpoints needed
- Authentication flow
- Session management

### 3. Production Deployment

Follow [production-checklist.md](./production-checklist.md):
- Set up dedicated TURN servers
- Implement authentication
- Add monitoring
- Load testing

## Key Files

### Unity
- `UnityProject/Assets/Scripts/RenderStreamControl.cs` - Main streaming controller
- `UnityProject/Assets/Stream-Settings.asset` - WebRTC configuration

### Backend
- `WebappBackend/src/server.ts` - Express server
- `WebappBackend/src/websocket.ts` - WebSocket signaling
- `WebappBackend/client/public/receiver/` - Viewer page

## API Reference

### Streaming Session

```typescript
// Start streaming session
POST /api/stream/session
Body: { userId: string, gameId: string }
Response: { sessionId: string, streamToken: string }

// List active streams
GET /api/stream/active
Response: Array<{ sessionId, userId, userName, viewers }>

// Join stream
POST /api/stream/join/:sessionId
Response: { viewerToken: string, streamUrl: string }
```

See [integration-example.md](./integration-example.md) for full API spec.

## Configuration

### Unity Settings

Edit `Stream-Settings.asset`:
```yaml
m_url: wss://your-backend.com  # Signaling server URL
m_iceServers:
  - urls: stun:stun.l.google.com:19302
  - urls: turn:your-turn-server.com:3478
    username: user
    credential: password
```

### Backend Environment Variables

```bash
PORT=80                    # Server port
TYPE=websocket             # Signaling type
MODE=public                # Public or private mode
SECURE=false               # Enable HTTPS (requires cert)
```

## Sending Game Data to Web

Use WebRTC Data Channels for real-time game state:

```csharp
// Unity
dataChannel.Send(Encoding.UTF8.GetBytes(
    JsonUtility.ToJson(new { score = 100 })
));
```

```javascript
// Web
dataChannel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Score:', data.score);
};
```

See [data-channel-guide.md](./data-channel-guide.md) for complete examples.

## Troubleshooting

### No video in browser?
1. Check browser console for errors
2. Check Unity logs for connection messages
3. Verify TURN servers are accessible
4. Try incognito mode (disable extensions)

### High latency?
1. Use dedicated TURN servers closer to users
2. Reduce video bitrate in Unity
3. Decrease frame rate (30fps → 24fps)
4. Check network conditions

### Connection keeps dropping?
1. Implement reconnection logic
2. Add ICE restart on failure
3. Check firewall/NAT settings
4. Monitor TURN server logs

## Cost Estimates

### Development (Current)
- Backend hosting: $0-20/month (Railway free tier)
- TURN servers: Free (public, unreliable)
- **Total: ~$0-20/month**

### Production (Recommended)
- Backend hosting: $50-100/month
- TURN servers: $100-300/month
- Database: $20-50/month
- Monitoring: $20-50/month
- **Total: ~$200-500/month for 10-50 concurrent streams**

See [production-checklist.md](./production-checklist.md) for detailed cost breakdown.

## Support & Resources

- [Unity WebRTC Package](https://docs.unity3d.com/Packages/com.unity.webrtc@latest)
- [WebRTC Fundamentals](https://webrtc.org/getting-started/overview)
- [Coturn TURN Server](https://github.com/coturn/coturn)
- [Railway Deployment](https://railway.app/docs)

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

[Your License Here]

## Next Steps

1. ✅ Test current setup locally
2. ✅ Deploy backend to Railway/AWS
3. ⬜ Implement authentication
4. ⬜ Add session management API
5. ⬜ Integrate into main web app
6. ⬜ Set up monitoring
7. ⬜ Load testing
8. ⬜ Launch! 🚀

