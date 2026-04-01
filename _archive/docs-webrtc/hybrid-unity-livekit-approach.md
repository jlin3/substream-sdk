# Hybrid Approach: Unity Render Streaming + LiveKit Backend

## Overview

This approach gives you the best of both worlds:
- **Unity Render Streaming** (proven, reliable) for Unity client
- **LiveKit SFU** for backend distribution, recording, and multi-viewer support

**Key Insight:** Both use WebRTC, so they can work together with a signaling bridge.

---

## Architecture

```
┌──────────────────────┐
│   Unity VR           │
│  (Quest Headset)     │
│                      │
│  Unity Render        │
│  Streaming Package   │ ← Keep this (proven)
└──────────┬───────────┘
           │
           │ WebRTC Offer/Answer
           ↓
┌──────────────────────┐
│  Signaling Bridge    │
│  (Your Backend)      │
│                      │
│  Translates:         │
│  Unity RenderStream  │
│  ↔ LiveKit Protocol  │
└──────────┬───────────┘
           │
           │ LiveKit Protocol
           ↓
┌──────────────────────┐
│   LiveKit Cloud      │
│                      │
│  - SFU (distribute)  │
│  - Recording (S3)    │
│  - TURN servers      │
│  - Webhooks          │
└──────────┬───────────┘
           │
           │ WebRTC Streams
           ↓
┌──────────────────────┐
│  Web Viewers         │
│  (Parents/Friends)   │
│                      │
│  LiveKit React SDK   │
└──────────────────────┘
```

---

## What Changes vs Current Setup

### Unity Side (Minimal Changes) ✅

**Keep:**
- `com.unity.renderstreaming` package ✅
- `RenderStreamControl.cs` (with small changes)
- All your camera/video setup ✅

**Change:**
- WebSocket URL points to your backend (instead of Railway)
- Backend gives Unity a LiveKit-compatible connection

**Code diff:**
```csharp
// OLD: Direct WebSocket to signaling server
m_url: wss://substream-sdk-test.up.railway.app

// NEW: Your backend that bridges to LiveKit
m_url: wss://your-backend.com/unity-bridge
```

### Backend Side (New Implementation)

**Add:**
- LiveKit SDK for token generation
- Bridge endpoint that translates Unity WebRTC ↔ LiveKit
- Webhook handlers for events
- Parent notification system

**Complexity:** Medium (but I'll provide all the code)

---

## Step-by-Step Implementation

### Phase 1: Backend Signaling Bridge (3-5 days)

Create a WebSocket endpoint that:
1. Receives Unity Render Streaming's WebRTC offers
2. Publishes them to LiveKit as a "participant"
3. Routes viewer connections through LiveKit

**File:** `WebappBackend/src/services/unity-livekit-bridge.ts`

```typescript
import { Room, LocalTrack } from 'livekit-client';
import { AccessToken } from 'livekit-server-sdk';
import WebSocket from 'ws';

export class UnityLiveKitBridge {
  private livekitRoom: Room | null = null;
  private unityConnection: WebSocket | null = null;

  /**
   * Handle incoming connection from Unity Render Streaming
   */
  async connectUnity(ws: WebSocket, userId: string) {
    this.unityConnection = ws;

    // Create LiveKit room for this Unity client
    const roomName = `unity-${userId}-${Date.now()}`;
    
    // Generate token for Unity's stream
    const token = await this.generateLiveKitToken(userId, roomName);
    
    // Connect to LiveKit on behalf of Unity
    this.livekitRoom = new Room();
    await this.livekitRoom.connect(
      process.env.LIVEKIT_URL!,
      token
    );

    // Bridge WebRTC signaling between Unity and LiveKit
    ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      await this.handleUnityMessage(message);
    });

    ws.on('close', () => {
      this.livekitRoom?.disconnect();
    });

    // Send room info back to Unity
    ws.send(JSON.stringify({
      type: 'room_ready',
      roomName: roomName,
      livekitUrl: process.env.LIVEKIT_URL
    }));
  }

  /**
   * Handle WebRTC messages from Unity Render Streaming
   */
  private async handleUnityMessage(message: any) {
    switch (message.type) {
      case 'offer':
        // Unity sent WebRTC offer
        await this.handleOffer(message.data);
        break;
      
      case 'answer':
        // Unity sent WebRTC answer
        await this.handleAnswer(message.data);
        break;
      
      case 'candidate':
        // ICE candidate from Unity
        await this.handleIceCandidate(message.data);
        break;
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.livekitRoom) return;

    // Unity's offer contains video/audio tracks
    // We need to publish these to LiveKit
    
    // This is complex - LiveKit expects tracks, not raw SDP
    // Alternative: Use LiveKit's native Unity SDK instead
    
    console.log('Received offer from Unity:', offer);
    
    // Forward to LiveKit (simplified - actual implementation more complex)
    // You may need to use LiveKit's Egress API or custom SFU integration
  }

  private async generateLiveKitToken(userId: string, roomName: string) {
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: userId,
        name: `Unity-${userId}`,
      }
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: false
    });

    return token.toJwt();
  }
}
```

---

## ⚠️ The Challenge with Hybrid Approach

**Here's the honest issue:** Unity Render Streaming and LiveKit speak slightly different "dialects" of WebRTC.

- **Unity Render Streaming:** Uses Unity's custom signaling protocol
- **LiveKit:** Uses LiveKit's signaling protocol

**Bridging them is possible but complex.** You'd essentially need to:
1. Accept Unity's WebRTC stream
2. Re-publish it to LiveKit as if it came from a LiveKit client
3. This requires deep WebRTC knowledge

---

## 🎯 My Updated Recommendation

After explaining the hybrid complexity, here are your **realistic options**:

### **Option 1: Validate Unity Render Streaming First, Then Decide** ⭐ SAFEST

**Week 1-2: Validate Unity Render Streaming**
```
Tasks:
- Fix current null reference bug (already done ✅)
- Test with Ben's VR setup
- Verify video quality is acceptable
- Test with multiple viewers
- Measure bandwidth costs

Decision Point:
✅ Works well → Keep it, add recording manually
✅ Works well → Migrate to LiveKit for better features
❌ Issues → Consider LiveKit native SDK
```

**Week 3-4: Add Production Features**
```
If keeping Unity Render Streaming:
- Add recording (FFmpeg or MediaRecorder API)
- Set up dedicated TURN servers
- Implement session management
- Add parent notifications

If migrating to LiveKit:
- Follow full migration plan
- Get recording, TURN, etc. built-in
```

**Pros:**
- ✅ De-risked approach
- ✅ Validate technology before committing
- ✅ Can stick with Unity if LiveKit doesn't work
- ✅ Learn what you actually need

**Cons:**
- ⏱️ Takes longer (4 weeks vs 3 weeks)
- May end up doing work twice

---

### **Option 2: Go All-In on LiveKit** ⚡ FASTEST TO PRODUCTION

**Week 1-3: Full Migration**
```
- Replace Unity Render Streaming with LiveKit Unity SDK
- Implement backend with LiveKit
- Update web viewers
- Get recording, TURN, notifications built-in
```

**Pros:**
- ✅ Fastest to full production features
- ✅ Best long-term solution
- ✅ Less maintenance
- ✅ Better scalability

**Cons:**
- ❌ Higher risk (new SDK)
- ❌ Can't leverage existing Unity Render Streaming work
- Need to trust LiveKit Unity SDK works on Quest

---

### **Option 3: Unity Render Streaming + Manual Backend** 🛠️ MOST CONTROL

**Keep Current Setup, Add:**
```
- Dedicated TURN servers (Twilio/Coturn)
- Recording via MediaRecorder API or FFmpeg
- Session management API
- Parent notification webhooks
```

**Pros:**
- ✅ Full control
- ✅ No vendor lock-in
- ✅ Keep proven Unity tech

**Cons:**
- ❌ Most engineering work (2-3 months)
- ❌ Ongoing maintenance
- ❌ You build everything LiveKit gives you

---

## 🎯 My Final Recommendation for You

Given your concerns and requirements:

### **Choose Option 1: Phased Validation**

**Phase 1 (This Week): Validate Current Setup**
1. Test with Ben - does Unity Render Streaming work reliably?
2. Check video quality in VR headset
3. Verify multiple viewers can connect
4. Test on actual parent's computer/phone

**Phase 2 (Week 2-3): Decision Based on Results**

If Unity Render Streaming works great:
```
Option A: Keep it, build recording/notifications manually (2-3 weeks)
Option B: Migrate to LiveKit for better features (3 weeks)
```

If Unity Render Streaming has issues:
```
Option C: Go full LiveKit from the start (3 weeks)
```

---

## Next Steps Right Now

1. **Test Current Setup with Ben**
   - Does the null reference fix work?
   - Can you see video in browser?
   - Is quality acceptable?

2. **While Testing, Research LiveKit**
   - Sign up for free account
   - Test their Unity SDK demo
   - Verify it works on Quest

3. **Make Decision After Testing** (1 week from now)
   - If Unity Render Streaming works: Keep or migrate?
   - If issues: Go LiveKit?

---

## Questions to Help Decide

**Ask yourself:**

1. **How urgent is this?**
   - Need it in 2 weeks → LiveKit all-in
   - Have 2+ months → Either approach works

2. **How important is control vs speed?**
   - Want control → Unity Render Streaming + manual
   - Want speed → LiveKit

3. **What's your team's expertise?**
   - Strong WebRTC → Either works
   - Less WebRTC → LiveKit (less to learn)

4. **Budget?**
   - $200-300/month → LiveKit is worth it
   - Tight budget → DIY with Unity Render Streaming

---

## What I Can Help With

**This week:**
- ✅ Test Unity Render Streaming with Ben
- ✅ Fix any bugs that come up
- ✅ Help you evaluate video quality

**Next week (after testing):**
- Help you choose best path forward
- Start implementation of chosen approach
- Whether that's LiveKit migration or adding features to current setup

**What do you want to do first?** 🚀

