# Substream SDK - Production VR Streaming

**Production-ready Unity WebRTC streaming for VR applications** with automatic recording, parent notifications, and enterprise-grade infrastructure.

Stream high-quality VR gameplay (1080p @ 30fps) from Quest headsets to web browsers with automatic recording to S3 and email notifications.

## 🎯 Features

- ✅ **High-Quality Streaming** - 1080p @ 30fps with adaptive bitrate
- ✅ **Automatic Recording** - Streams recorded and saved to S3
- ✅ **Parent Notifications** - Email alerts when streaming starts/ends
- ✅ **Multi-Viewer** - Unlimited concurrent viewers per stream
- ✅ **Secure** - JWT authentication for all connections
- ✅ **Scalable** - Production-grade infrastructure
- ✅ **Quest VR Ready** - Optimized for Meta Quest headsets

## 🚀 Quick Start

### For Game Developers (Use Our Backend)

**Just want to add streaming to your Unity VR game?**

See: [`SDK_INTEGRATION_GUIDE.md`](SDK_INTEGRATION_GUIDE.md)

**Steps:**
1. Install Unity Render Streaming package (5 min)
2. Copy `RenderStreamControl.cs` to your project (2 min)
3. Configure backend URL we provide (3 min)
4. Test streaming (5 min)

**Total: ~15-20 minutes to working streaming in your game!**

We host the backend - you just integrate the SDK.

---

### For Platform Owners (Deploy Your Own Backend)

**Want to run your own streaming infrastructure?**

See: [`DEVELOPER_SETUP.md`](DEVELOPER_SETUP.md)

Complete guide for deploying backend with Railway, Supabase, etc.

**Total: 2-3 hours to full production deployment**

---

### For Development Testing (This Repo)

1. **Clone repository**
   ```bash
   git clone https://github.com/jlin3/substream-sdk.git
   cd substream-sdk
   ```

2. **Start backend** (minimal config for testing)
   ```bash
   cd WebappBackend
   npm install
   npm run dev
   # Server runs on http://localhost
   ```

3. **Open receiver page**
   - Open `WebappBackend/client/public/receiver/index.html` in browser
   - Click Play button

4. **Start Unity streaming**
   - Open `UnityProject` in Unity 2023+
   - Open `Stream-test` scene
   - Press Play → Press `L` key to stream
   - Video should appear in browser!

### For Production Deployment

**See:** [`docs/SETUP_CHECKLIST.md`](docs/SETUP_CHECKLIST.md) for complete 3-week deployment plan.

**Quick overview:**
1. Set up external services (Supabase, AWS, Twilio, SendGrid) - 90 minutes
2. Deploy backend to Railway - 30 minutes
3. Configure Unity with production settings - 15 minutes
4. Integrate into your web app - 2-3 days
5. Test and launch - 2-3 days

---

## 📚 Documentation

### Essential Guides
- **[PRODUCTION_READY_SUMMARY.md](PRODUCTION_READY_SUMMARY.md)** - What's done and what remains
- **[docs/SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md)** - Day-by-day deployment checklist
- **[docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)** - Complete deployment guide
- **[docs/WEB_APP_INTEGRATION.md](docs/WEB_APP_INTEGRATION.md)** - React/TypeScript integration examples

### Technical Guides
- **[docs/TURN_SERVER_SETUP.md](docs/TURN_SERVER_SETUP.md)** - Configure TURN servers (Twilio/self-hosted)
- **[docs/data-channel-guide.md](docs/data-channel-guide.md)** - Send game data to browsers
- **[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)** - Detailed implementation tracking

### Alternative Approaches
- **[docs/LIVEKIT_TEST.md](docs/LIVEKIT_TEST.md)** - Test LiveKit as alternative
- **[docs/livekit-migration-plan.md](docs/livekit-migration-plan.md)** - Full LiveKit migration guide
- **[docs/hybrid-unity-livekit-approach.md](docs/hybrid-unity-livekit-approach.md)** - Hybrid approach analysis

---

## 🏗️ Architecture

```
┌─────────────────────┐
│   Unity VR Quest    │
│  RenderStreamControl │
│   - 1080p stream    │
│   - Auth token      │
│   - Session API     │
└──────────┬──────────┘
           │ WebSocket (authenticated)
           ↓
┌──────────────────────┐      ┌─────────────────┐
│   Backend (Railway)  │─────▶│  Supabase DB    │
│  - JWT auth          │      │  - Sessions     │
│  - Session API       │      │  - Viewers      │
│  - WebRTC signaling  │      │  - Recordings   │
│  - Rate limiting     │      └─────────────────┘
│  - Sentry tracking   │
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     │            │
     ↓            ↓
┌──────────┐  ┌──────────────┐
│ AWS S3   │  │  SendGrid    │
│ Record-  │  │  Email       │
│ ings     │  │  Notifica-   │
└──────────┘  │  tions       │
              └──────────────┘
     ↓
┌──────────────────────┐
│  Web Viewers         │
│  - Browser clients   │
│  - Auto-recording    │
│  - React components  │
└──────────────────────┘
```

---

## 🛠️ Tech Stack

**Unity:**
- Unity 2023+
- Unity Render Streaming v3.1.0-exp7
- WebRTC for Unity

**Backend:**
- Node.js + TypeScript + Express
- WebSocket (ws package)
- Supabase (PostgreSQL database)
- AWS S3 (recording storage)
- SendGrid (email notifications)
- Sentry (error tracking)

**Frontend:**
- Vanilla JS receiver (provided)
- React integration examples (documented)
- MediaRecorder API for recording

---

## 💰 Cost Estimate

**Development/Testing:**
- Free tier services sufficient
- ~$20-50/month

**Production (20-50 concurrent streams):**
- Railway: $20-50/month
- AWS S3: $20-50/month
- Twilio TURN: $100-200/month
- SendGrid: $15-20/month
- Supabase: $0-25/month
- Sentry: $0-26/month

**Total: $155-371/month**

---

## 🧪 Testing

### Local Development
```bash
cd WebappBackend
npm install
npm run dev
# Open receiver/index.html in browser
# Start Unity and press 'L' to stream
```

### Production Testing
After deployment, verify:
```bash
# Health check
curl https://your-backend.up.railway.app/health

# Should return all features: true
```

---

## 🔒 Security

- JWT authentication for all API calls
- WebSocket token validation
- CORS restricted to allowed origins
- Rate limiting (100 req/15min)
- Presigned S3 URLs for downloads
- Row-level security in database
- Environment-based configuration

---

## 📦 What's Included

### Unity Project (`UnityProject/`)
- `RenderStreamControl.cs` - Main streaming controller with auth & API integration
- `Stream-Settings.asset` - WebRTC configuration
- Test scene with VR camera setup

### Backend (`WebappBackend/`)
- Complete REST API for sessions and recordings
- WebSocket signaling server with authentication
- Database integration (Supabase)
- Storage integration (S3)
- Email notifications (SendGrid)
- Browser recording system
- Production deployment config

### Documentation (`docs/`)
- Complete setup and deployment guides
- React/TypeScript integration examples
- API reference and code samples
- Security best practices
- Troubleshooting guides

---

## 🚦 Current Status

**✅ Production Infrastructure: COMPLETE**
- All backend code implemented and tested
- Database schema ready
- Authentication system ready
- Recording system ready
- Notification system ready

**🔄 Deployment: READY (needs external service setup)**
- Need 90 minutes to configure Supabase, AWS, Twilio, SendGrid
- Then deploy to Railway in 30 minutes

**⏳ Integration: IN PROGRESS**
- Unity code updated with API integration
- Need to test with production backend
- Frontend integration examples provided

**Timeline:** 2-3 weeks to full production launch

---

## 🆘 Support

- Review [SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md) for guided setup
- Check [PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) for deployment help
- See [WEB_APP_INTEGRATION.md](docs/WEB_APP_INTEGRATION.md) for frontend integration
- Check Railway logs for backend issues
- Review Sentry for error tracking

---

## 📄 License

[Your License Here]

---

## 🙏 Credits

Built with:
- Unity Render Streaming
- WebRTC
- Railway
- Supabase
- AWS S3
- Twilio
- SendGrid
