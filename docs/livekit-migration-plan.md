# LiveKit Migration Plan

## Overview

This plan migrates from Unity Render Streaming to LiveKit for:
- ✅ Easier recording & storage
- ✅ Built-in TURN servers
- ✅ Auto-scaling
- ✅ Parent notifications via webhooks
- ✅ 70% less code to maintain

**Timeline:** 2-3 weeks  
**Risk:** Medium (new SDK, but well-documented)  
**Effort:** ~40-60 hours total

---

## Phase 0: Decision & Setup (2-3 days)

### Day 1: Evaluation & Account Setup

**Tasks:**
- [ ] Create LiveKit Cloud account
- [ ] Review pricing for your expected usage
- [ ] Get API credentials (URL, Key, Secret)
- [ ] Test basic connection from browser

**Cost Analysis:**
```
Expected usage (20-50 concurrent streams, 1080p):
- Data per stream: ~2-4GB/hour
- Monthly egress: ~500GB - 2TB
- Recommended plan: Pro ($299/month) or negotiate Enterprise
```

**Decision Point:** 
- ✅ Proceed with LiveKit Cloud
- ⬜ Self-host LiveKit (save costs, more work)
- ⬜ Stick with current solution

---

## Phase 1: Backend API Changes (3-5 days)

### What Changes:
- Replace WebSocket signaling with LiveKit token generation
- Add webhook endpoints for LiveKit events
- Set up recording storage (S3/GCS)

### 1.1: Install LiveKit Server SDK

```bash
cd WebappBackend
npm install livekit-server-sdk
```

### 1.2: Environment Variables

Add to `.env`:
```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Recording Storage (S3)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_BUCKET=vr-recordings
AWS_REGION=us-east-1

# Notifications
SENDGRID_API_KEY=your-sendgrid-key  # For parent emails
```

### 1.3: Create LiveKit Service

**File:** `WebappBackend/src/services/livekit.service.ts`

```typescript
import { AccessToken, RoomServiceClient, Room } from 'livekit-server-sdk';

export class LiveKitService {
  private roomClient: RoomServiceClient;
  private apiKey: string;
  private apiSecret: string;
  private livekitUrl: string;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY!;
    this.apiSecret = process.env.LIVEKIT_API_SECRET!;
    this.livekitUrl = process.env.LIVEKIT_URL!;
    
    this.roomClient = new RoomServiceClient(
      this.livekitUrl,
      this.apiKey,
      this.apiSecret
    );
  }

  /**
   * Generate token for Unity client (streamer)
   */
  async createStreamerToken(userId: string, userName: string, gameId: string) {
    const roomName = `game-${gameId}-${Date.now()}`;
    
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: userName,
      metadata: JSON.stringify({
        role: 'streamer',
        gameId: gameId,
        startedAt: new Date().toISOString()
      })
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,  // For game data
      canSubscribe: false     // Streamer doesn't need to receive
    });

    // Create room with recording enabled
    await this.roomClient.createRoom({
      name: roomName,
      emptyTimeout: 300,  // 5 min timeout when empty
      maxParticipants: 100,
      metadata: JSON.stringify({
        gameId,
        streamerId: userId,
        createdAt: new Date().toISOString()
      })
    });

    return {
      token: token.toJwt(),
      roomName: roomName,
      url: this.livekitUrl
    };
  }

  /**
   * Generate token for viewer
   */
  async createViewerToken(userId: string, userName: string, roomName: string) {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: userName,
      metadata: JSON.stringify({
        role: 'viewer',
        joinedAt: new Date().toISOString()
      })
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: false,
      canPublishData: true,  // Can send chat messages
      canSubscribe: true
    });

    return {
      token: token.toJwt(),
      roomName: roomName,
      url: this.livekitUrl
    };
  }

  /**
   * Start recording for a room
   */
  async startRecording(roomName: string) {
    // LiveKit will use the webhook to notify when recording starts/stops
    // Recording configuration is done in the room creation or via dashboard
  }

  /**
   * List active rooms
   */
  async getActiveRooms(): Promise<Room[]> {
    return await this.roomClient.listRooms();
  }

  /**
   * Get room info
   */
  async getRoomInfo(roomName: string): Promise<Room> {
    return await this.roomClient.listRooms([roomName]).then(rooms => rooms[0]);
  }
}
```

### 1.4: Update API Routes

**File:** `WebappBackend/src/routes/stream.routes.ts`

```typescript
import { Router } from 'express';
import { LiveKitService } from '../services/livekit.service';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const livekit = new LiveKitService();

/**
 * Start streaming session (Unity calls this)
 */
router.post('/session/start', authenticateUser, async (req, res) => {
  try {
    const { gameId } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    // Generate LiveKit token for Unity client
    const session = await livekit.createStreamerToken(userId, userName, gameId);

    // Save session to database
    await db.streamSessions.create({
      id: session.roomName,
      userId: userId,
      gameId: gameId,
      startedAt: new Date(),
      status: 'active'
    });

    res.json({
      livekitUrl: session.url,
      token: session.token,
      roomName: session.roomName
    });
  } catch (error) {
    console.error('Failed to start session:', error);
    res.status(500).json({ error: 'Failed to start streaming session' });
  }
});

/**
 * Join stream as viewer
 */
router.post('/session/join/:roomName', authenticateUser, async (req, res) => {
  try {
    const { roomName } = req.params;
    const userId = req.user.id;
    const userName = req.user.name;

    // Verify room exists
    const room = await livekit.getRoomInfo(roomName);
    if (!room) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Generate viewer token
    const session = await livekit.createViewerToken(userId, userName, roomName);

    // Track viewer in database
    await db.streamViewers.create({
      sessionId: roomName,
      userId: userId,
      joinedAt: new Date()
    });

    res.json({
      livekitUrl: session.url,
      token: session.token,
      roomName: session.roomName
    });
  } catch (error) {
    console.error('Failed to join session:', error);
    res.status(500).json({ error: 'Failed to join stream' });
  }
});

/**
 * Get active streams
 */
router.get('/active', async (req, res) => {
  try {
    const rooms = await livekit.getActiveRooms();
    
    // Enrich with database info
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        const session = await db.streamSessions.findOne({
          where: { id: room.name }
        });
        
        return {
          roomName: room.name,
          numParticipants: room.numParticipants,
          creationTime: room.creationTime,
          streamer: session?.user || null,
          gameId: session?.gameId || null
        };
      })
    );

    res.json(enrichedRooms);
  } catch (error) {
    console.error('Failed to get active rooms:', error);
    res.status(500).json({ error: 'Failed to get active streams' });
  }
});

export default router;
```

### 1.5: Add Webhook Handler

**File:** `WebappBackend/src/routes/webhook.routes.ts`

```typescript
import { Router } from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { sendParentNotification } from '../services/notification.service';

const router = Router();
const webhookReceiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

router.post('/livekit', async (req, res) => {
  try {
    // Verify webhook signature
    const event = webhookReceiver.receive(
      JSON.stringify(req.body),
      req.headers.authorization || ''
    );

    console.log('LiveKit webhook event:', event.event);

    switch (event.event) {
      case 'room_started':
        await handleRoomStarted(event);
        break;
        
      case 'room_finished':
        await handleRoomFinished(event);
        break;
        
      case 'participant_joined':
        await handleParticipantJoined(event);
        break;
        
      case 'egress_started':
        await handleRecordingStarted(event);
        break;
        
      case 'egress_ended':
        await handleRecordingFinished(event);
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(400);
  }
});

async function handleRoomStarted(event: any) {
  const { room } = event;
  console.log(`Room started: ${room.name}`);
  
  // Update database
  await db.streamSessions.update(
    { status: 'live' },
    { where: { id: room.name } }
  );
}

async function handleParticipantJoined(event: any) {
  const { room, participant } = event;
  const metadata = JSON.parse(participant.metadata || '{}');
  
  if (metadata.role === 'streamer') {
    // Streamer joined - send notification to parent
    const session = await db.streamSessions.findOne({
      where: { id: room.name },
      include: ['user']
    });
    
    if (session?.user?.parentEmail) {
      await sendParentNotification({
        to: session.user.parentEmail,
        subject: `${participant.name} is streaming live!`,
        template: 'stream-started',
        data: {
          childName: participant.name,
          watchUrl: `https://yourapp.com/watch/${room.name}`,
          gameId: metadata.gameId
        }
      });
    }
  }
  
  console.log(`Participant joined ${room.name}: ${participant.identity}`);
}

async function handleRecordingFinished(event: any) {
  const { egressInfo, room } = event;
  
  if (egressInfo.status === 'EGRESS_COMPLETE') {
    const fileResult = egressInfo.fileResults[0];
    const recordingUrl = fileResult.downloadUrl;
    
    console.log(`Recording ready for ${room.name}: ${recordingUrl}`);
    
    // Save recording URL to database
    await db.streamRecordings.create({
      sessionId: room.name,
      url: recordingUrl,
      duration: fileResult.duration,
      size: fileResult.size,
      createdAt: new Date()
    });
    
    // Notify parent that recording is ready
    const session = await db.streamSessions.findOne({
      where: { id: room.name },
      include: ['user']
    });
    
    if (session?.user?.parentEmail) {
      await sendParentNotification({
        to: session.user.parentEmail,
        subject: `${session.user.name}'s stream recording is ready`,
        template: 'recording-ready',
        data: {
          childName: session.user.name,
          recordingUrl: recordingUrl,
          duration: Math.round(fileResult.duration / 60) + ' minutes'
        }
      });
    }
  }
}

async function handleRoomFinished(event: any) {
  const { room } = event;
  console.log(`Room finished: ${room.name}`);
  
  // Update database
  await db.streamSessions.update(
    { 
      status: 'ended',
      endedAt: new Date()
    },
    { where: { id: room.name } }
  );
}

async function handleRecordingStarted(event: any) {
  const { egressInfo, room } = event;
  console.log(`Recording started for ${room.name}`);
}

export default router;
```

### 1.6: Update Server

**File:** `WebappBackend/src/server.ts`

```typescript
import streamRoutes from './routes/stream.routes';
import webhookRoutes from './routes/webhook.routes';

// ... existing code ...

// Add new routes
app.use('/api/stream', streamRoutes);
app.use('/webhook', webhookRoutes);
```

**Estimated Time:** 3-5 days  
**Complexity:** Medium

---

## Phase 2: Unity Client Migration (5-7 days)

### What Changes:
- Remove Unity Render Streaming package
- Install LiveKit Unity SDK
- Replace `RenderStreamControl.cs` with LiveKit integration
- Update scene setup

### 2.1: Remove Old Package

1. Open Unity project
2. Window → Package Manager
3. Find "WebRTC" and "Render Streaming"
4. Click Remove

### 2.2: Install LiveKit Unity SDK

```bash
# Download from GitHub
# https://github.com/livekit/client-sdk-unity/releases

# Or via Package Manager:
# Add package from git URL:
https://github.com/livekit/client-sdk-unity.git#main
```

### 2.3: Create New Streaming Controller

**File:** `UnityProject/Assets/Scripts/LiveKitStreamControl.cs`

```csharp
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using LiveKit;
using TMPro;
using UnityEngine.Events;

public class LiveKitStreamControl : MonoBehaviour
{
    [Header("UI References")]
    public TMP_Text statusText;
    public GameObject recordingIndicator;
    
    [Header("Stream Settings")]
    public string backendUrl = "https://your-backend.com";
    public string gameId = "your-game-id";
    
    [Header("Video Settings")]
    public int videoWidth = 1920;
    public int videoHeight = 1080;
    public int frameRate = 30;
    public int bitrate = 3000000; // 3 Mbps
    
    [Header("Events")]
    public UnityEvent OnStreamStarted;
    public UnityEvent OnStreamStopped;
    public UnityEvent OnViewerJoined;
    
    private Room room;
    private LocalVideoTrack videoTrack;
    private LocalAudioTrack audioTrack;
    private RenderTexture renderTexture;
    private Camera streamCamera;
    private bool isStreaming = false;
    private string authToken; // Your app's auth token
    
    void Start()
    {
        SetupStreamCamera();
    }
    
    private void SetupStreamCamera()
    {
        // Find or create camera for streaming
        GameObject camObj = GameObject.FindGameObjectWithTag("MainCamera");
        if (camObj == null)
        {
            Debug.LogError("No MainCamera found!");
            return;
        }
        
        // Create render texture
        renderTexture = new RenderTexture(videoWidth, videoHeight, 24);
        renderTexture.Create();
        
        // Get or add camera component
        streamCamera = camObj.GetComponent<Camera>();
        if (streamCamera == null)
        {
            streamCamera = camObj.AddComponent<Camera>();
        }
        
        streamCamera.targetTexture = renderTexture;
        
        Debug.Log($"Stream camera setup: {videoWidth}x{videoHeight} @ {frameRate}fps");
    }
    
    public async void StartStreaming()
    {
        if (isStreaming)
        {
            Debug.LogWarning("Already streaming!");
            return;
        }
        
        try {
            UpdateStatus("Connecting to server...");
            
            // Get LiveKit token from your backend
            var sessionData = await GetStreamingSession();
            
            if (sessionData == null)
            {
                UpdateStatus("ERROR: Failed to get session");
                return;
            }
            
            UpdateStatus("Connecting to LiveKit...");
            
            // Create room
            room = new Room();
            
            // Subscribe to events
            room.ParticipantConnected += OnParticipantConnected;
            room.ParticipantDisconnected += OnParticipantDisconnected;
            room.Disconnected += OnDisconnected;
            
            // Connect to LiveKit
            await room.Connect(sessionData.livekitUrl, sessionData.token);
            
            UpdateStatus("Publishing video...");
            
            // Create and publish video track
            var videoOptions = new VideoPublishOptions
            {
                width = (uint)videoWidth,
                height = (uint)videoHeight,
                frameRate = (uint)frameRate,
                bitrate = (uint)bitrate
            };
            
            videoTrack = await LocalVideoTrack.CreateVideoTrack(
                "camera",
                new RenderTextureVideoSource(renderTexture),
                videoOptions
            );
            
            await room.LocalParticipant.PublishTrack(videoTrack);
            
            UpdateStatus("Publishing audio...");
            
            // Create and publish audio track
            audioTrack = await LocalAudioTrack.CreateAudioTrack();
            await room.LocalParticipant.PublishTrack(audioTrack);
            
            isStreaming = true;
            UpdateStatus($"LIVE - Room: {sessionData.roomName}");
            
            if (recordingIndicator != null)
                recordingIndicator.SetActive(true);
            
            OnStreamStarted?.Invoke();
            
            Debug.Log($"✅ Streaming started! Room: {sessionData.roomName}");
        }
        catch (Exception e)
        {
            Debug.LogError($"Failed to start streaming: {e.Message}\n{e.StackTrace}");
            UpdateStatus($"ERROR: {e.Message}");
            StopStreaming();
        }
    }
    
    public async void StopStreaming()
    {
        if (!isStreaming) return;
        
        try
        {
            UpdateStatus("Stopping stream...");
            
            // Unpublish tracks
            if (videoTrack != null)
            {
                await room.LocalParticipant.UnpublishTrack(videoTrack);
                videoTrack.Dispose();
                videoTrack = null;
            }
            
            if (audioTrack != null)
            {
                await room.LocalParticipant.UnpublishTrack(audioTrack);
                audioTrack.Dispose();
                audioTrack = null;
            }
            
            // Disconnect from room
            if (room != null)
            {
                await room.Disconnect();
                room = null;
            }
            
            isStreaming = false;
            UpdateStatus("Stream stopped");
            
            if (recordingIndicator != null)
                recordingIndicator.SetActive(false);
            
            OnStreamStopped?.Invoke();
            
            Debug.Log("Stream stopped");
        }
        catch (Exception e)
        {
            Debug.LogError($"Error stopping stream: {e}");
        }
    }
    
    public void ToggleStreaming()
    {
        if (isStreaming)
            StopStreaming();
        else
            StartStreaming();
    }
    
    private void OnParticipantConnected(RemoteParticipant participant)
    {
        Debug.Log($"Viewer joined: {participant.Name}");
        OnViewerJoined?.Invoke();
    }
    
    private void OnParticipantDisconnected(RemoteParticipant participant)
    {
        Debug.Log($"Viewer left: {participant.Name}");
    }
    
    private void OnDisconnected(string reason)
    {
        Debug.Log($"Disconnected: {reason}");
        StopStreaming();
    }
    
    private void UpdateStatus(string message)
    {
        if (statusText != null)
            statusText.text = message;
        Debug.Log($"Status: {message}");
    }
    
    // Call your backend to get LiveKit token
    [Serializable]
    private class SessionResponse
    {
        public string livekitUrl;
        public string token;
        public string roomName;
    }
    
    private async System.Threading.Tasks.Task<SessionResponse> GetStreamingSession()
    {
        string url = $"{backendUrl}/api/stream/session/start";
        
        var requestData = new {
            gameId = gameId
        };
        
        string json = JsonUtility.ToJson(requestData);
        
        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            var operation = request.SendWebRequest();
            
            while (!operation.isDone)
                await System.Threading.Tasks.Task.Yield();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                return JsonUtility.FromJson<SessionResponse>(request.downloadHandler.text);
            }
            else
            {
                Debug.LogError($"Failed to get session: {request.error}");
                return null;
            }
        }
    }
    
    void OnDestroy()
    {
        if (isStreaming)
            StopStreaming();
        
        if (renderTexture != null)
        {
            renderTexture.Release();
            Destroy(renderTexture);
        }
    }
    
    void Update()
    {
        // Debug: Press U to toggle streaming (remove in production)
        if (Input.GetKeyDown(KeyCode.U))
        {
            ToggleStreaming();
        }
    }
}
```

### 2.4: Update Scene

1. Remove old `RenderStreamControl` component
2. Add `LiveKitStreamControl` component to appropriate GameObject
3. Configure UI references
4. Test in Unity Editor first

**Estimated Time:** 5-7 days  
**Complexity:** Medium-High

---

## Phase 3: Web Viewer Update (3-4 days)

### 3.1: Install LiveKit React Components

```bash
cd your-web-app
npm install @livekit/react-components livekit-client
```

### 3.2: Create Stream Viewer Component

```tsx
import { LiveKitRoom, VideoRenderer, useParticipants } from '@livekit/react-components';
import { useState, useEffect } from 'react';

export function VRStreamViewer({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    // Get viewer token from backend
    fetch(`/api/stream/session/join/${roomName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    })
      .then(r => r.json())
      .then(data => setToken(data.token));
  }, [roomName]);
  
  if (!token) {
    return <div>Loading stream...</div>;
  }
  
  return (
    <LiveKitRoom
      serverUrl={process.env.REACT_APP_LIVEKIT_URL!}
      token={token}
      connectOptions={{ autoSubscribe: true }}
      onConnected={() => console.log('Connected to stream!')}
    >
      <StreamView />
    </LiveKitRoom>
  );
}

function StreamView() {
  const participants = useParticipants();
  
  return (
    <div className="stream-container">
      {participants.map((participant) => (
        <div key={participant.sid} className="participant">
          <VideoRenderer participant={participant} />
          <div className="participant-info">
            {participant.identity}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Estimated Time:** 3-4 days  
**Complexity:** Low-Medium

---

## Phase 4: Testing & Deployment (3-5 days)

### 4.1: Testing Checklist

- [ ] Unity can start/stop streaming
- [ ] Web viewer receives video/audio
- [ ] Recording starts automatically
- [ ] Recording saved to S3
- [ ] Webhook notifications work
- [ ] Parent email notifications sent
- [ ] Multiple viewers can watch
- [ ] Stream quality is good (1080p, 30fps)
- [ ] Network interruption handling
- [ ] Load testing (10+ concurrent streams)

### 4.2: Deployment

1. Deploy updated backend to Railway/AWS
2. Configure LiveKit webhooks in LiveKit dashboard
3. Set up S3 bucket for recordings
4. Configure email service (SendGrid/AWS SES)
5. Build and deploy Unity app
6. Deploy web app updates

**Estimated Time:** 3-5 days  
**Complexity:** Medium

---

## Total Timeline Summary

| Phase | Duration | Complexity |
|-------|----------|------------|
| 0. Decision & Setup | 2-3 days | Low |
| 1. Backend API | 3-5 days | Medium |
| 2. Unity Client | 5-7 days | Medium-High |
| 3. Web Viewer | 3-4 days | Low-Medium |
| 4. Testing & Deploy | 3-5 days | Medium |
| **TOTAL** | **16-24 days** | **Medium** |

**Realistic Timeline:** 3-4 weeks with 1-2 developers

---

## Rollback Plan

If migration fails, you can:
1. Keep old code in separate branch
2. Revert Unity package changes
3. Switch backend endpoints back
4. Deploy old version

**Git Strategy:**
```bash
git checkout -b feature/livekit-migration
# Work in this branch
# Keep main branch stable
# Merge only when fully tested
```

---

## Cost Comparison

### Old Setup (Custom WebRTC)
- TURN servers: $100-300/month
- Backend hosting: $50-100/month
- Storage: $20-50/month
- Dev time: Ongoing maintenance
- **Total: $170-450/month + significant dev time**

### LiveKit Setup
- LiveKit Pro: $299/month (includes TURN, recording, everything)
- Backend hosting: $50/month (simpler, less load)
- Storage: Included or $0-20/month (S3 fees)
- Dev time: Minimal maintenance
- **Total: $349/month + minimal dev time**

**ROI:** Worth it for reduced complexity and better features

---

## Risk Mitigation

### Risk 1: LiveKit SDK bugs
**Mitigation:** Test thoroughly, have support plan with LiveKit

### Risk 2: Cost escalation
**Mitigation:** Start with Pro plan, monitor usage, can self-host if needed

### Risk 3: Migration complexity
**Mitigation:** Parallel run - keep old system while testing new one

### Risk 4: Parent notifications not working
**Mitigation:** Test webhooks extensively before launch

---

## Success Criteria

Migration is successful when:
- ✅ Unity streams to LiveKit without errors
- ✅ Web viewers can watch streams
- ✅ Recordings automatically saved to S3
- ✅ Parents receive email when kid starts streaming
- ✅ Parents receive email when recording ready
- ✅ No significant quality degradation
- ✅ System handles 20+ concurrent streams
- ✅ Cost within expected range ($300-400/month)

---

## Next Steps

1. **Decision:** Review this plan and approve
2. **Setup:** Create LiveKit account and get credentials
3. **Kickoff:** Start Phase 1 (Backend API)
4. **Weekly check-ins:** Review progress and adjust

**Ready to proceed? Let me know and I'll help with each phase!**

