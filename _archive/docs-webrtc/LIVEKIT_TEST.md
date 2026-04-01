# LiveKit Testing Repository

🚀 **New Test Repo Created:** https://github.com/jlin3/livekit-vr-test

## What is it?

A **parallel proof-of-concept** to test LiveKit for VR streaming without disrupting your current Unity Render Streaming setup.

This lets you:
- ✅ Compare both approaches side-by-side
- ✅ Test LiveKit on Quest VR headset
- ✅ Validate video quality
- ✅ Test recording and webhooks
- ✅ Make an informed decision

## Quick Start

### 1. Clone the Test Repo
```bash
git clone https://github.com/jlin3/livekit-vr-test.git
cd livekit-vr-test
```

### 2. Get LiveKit Credentials
1. Sign up at https://cloud.livekit.io
2. Create a project
3. Copy credentials (URL, API Key, Secret)
4. Add to `backend/.env` (see `backend/ENV_SETUP.md`)

### 3. Start Backend
```bash
cd backend
npm install
npm run dev
```

### 4. Test Web Viewer
Open `viewer/index.html` in your browser

### 5. Add to Unity
1. Install LiveKit Unity SDK (Package Manager → Git URL)
2. Copy `unity-setup/LiveKitTest.cs` to your Unity project
3. Add to a GameObject
4. Configure Backend URL
5. Press Play, then press `L` to stream

## What's Included

| File | Purpose |
|------|---------|
| `backend/server.js` | Token generation (~100 lines) |
| `unity-setup/LiveKitTest.cs` | Unity streaming (~200 lines) |
| `viewer/index.html` | Simple web viewer (no build) |
| `README.md` | Complete setup guide |

## Test Plan (5 days)

**Day 1:** Backend + Web Viewer
- [ ] Set up LiveKit account
- [ ] Run backend locally
- [ ] Test web viewer connects

**Day 2-3:** Unity Integration
- [ ] Install LiveKit Unity SDK
- [ ] Test streaming from Unity Editor
- [ ] Test on Quest headset

**Day 4:** Features
- [ ] Test recording (configure in LiveKit dashboard)
- [ ] Test webhooks
- [ ] Test multiple viewers

**Day 5:** Decision
- Compare with Unity Render Streaming
- Choose which approach to use

## Comparison: Unity Render Streaming vs LiveKit

| Aspect | Current (Unity RS) | LiveKit Test |
|--------|-------------------|--------------|
| **Unity Code** | 389 lines | ~200 lines |
| **Backend Code** | ~1000 lines | ~100 lines |
| **TURN Setup** | Manual | Built-in |
| **Recording** | DIY | Automatic |
| **Webhooks** | DIY | Built-in |
| **Monthly Cost** | $200-400 | $299 |
| **Dev Time** | 3-4 weeks | Already done! |

## Decision Criteria

### Choose Unity Render Streaming if:
- ❌ LiveKit doesn't work well on Quest
- ❌ Video quality is worse
- ❌ Too expensive for your scale
- ✅ You want 100% control

### Choose LiveKit if:
- ✅ Works great on Quest
- ✅ Recording/webhooks work perfectly
- ✅ Much simpler codebase
- ✅ Faster to production features

## Next Steps

1. **This Week:** Test LiveKit setup
2. **Continue:** Testing current Unity Render Streaming (with Ben)
3. **Next Week:** Compare results and decide
4. **After Decision:** Commit to one approach

## Important Note

⚠️ **This is a TEST repo** - your current Unity Render Streaming setup is untouched.

You can run both in parallel:
- Unity Render Streaming: Port 80 (Railway backend)
- LiveKit Test: Port 3001 (local backend)

Test both, compare, then choose!

## Resources

- LiveKit Test Repo: https://github.com/jlin3/livekit-vr-test
- LiveKit Docs: https://docs.livekit.io
- Unity SDK: https://github.com/livekit/client-sdk-unity
- Migration Plan (if you choose LiveKit): `docs/livekit-migration-plan.md`

## Questions?

Test first, then we can discuss:
- Which approach worked better?
- What issues did you encounter?
- Which meets your needs?

**No commitment needed** - just testing both options! 🚀

