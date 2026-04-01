# Web App Integration Guide

Guide for integrating VR streaming into your existing web application.

## Overview

Your web app needs to:
1. Pass auth tokens to Unity and viewer
2. Display live streams in iframe or native component
3. Show list of active streams
4. Display recordings
5. Handle parent notifications

---

## Part 1: Unity Client Integration

### Passing Auth Token to Unity

When a user launches your VR app from your web platform, you need to pass their auth token.

#### Option A: Deep Link (Recommended for Quest)

```typescript
// In your web app
function launchVRApp(userId: string, authToken: string) {
  // Create deep link with auth token
  const deepLink = `yourapp://launch?token=${encodeURIComponent(authToken)}&userId=${userId}`;
  
  // On Quest, this opens your Unity app
  window.location.href = deepLink;
}
```

In Unity, handle the deep link:

```csharp
// Add to RenderStreamControl.cs or separate script
void OnApplicationFocus(bool hasFocus)
{
    if (hasFocus)
    {
        // Check for deep link parameters
        string[] args = System.Environment.GetCommandLineArgs();
        foreach (string arg in args)
        {
            if (arg.StartsWith("token="))
            {
                string token = arg.Substring(6);
                // Decode and set token
                GetComponent<RenderStreamControl>().SetAuthToken(UnityWebRequest.UnEscapeURL(token));
            }
        }
    }
}
```

#### Option B: PlayerPrefs (For Testing)

In Unity Editor or build:

```csharp
// Set token before launching game
PlayerPrefs.SetString("AuthToken", "your-jwt-token");
PlayerPrefs.Save();
```

The `RenderStreamControl` script already loads from PlayerPrefs automatically.

---

## Part 2: Viewer Integration

### Option 1: iframe Embed (Simplest)

```tsx
// React component
import { useState, useEffect } from 'react';

interface VRStreamViewerProps {
  sessionId: string;
  authToken: string;
  backendUrl: string;
}

export function VRStreamViewer({ sessionId, authToken, backendUrl }: VRStreamViewerProps) {
  const viewerUrl = `${backendUrl}/receiver?session=${sessionId}&token=${authToken}&record=true`;
  
  return (
    <div className="vr-stream-container">
      <iframe
        src={viewerUrl}
        style={{
          width: '100%',
          height: '600px',
          border: 'none',
          borderRadius: '8px'
        }}
        allow="camera; microphone; autoplay; fullscreen"
        title="VR Stream"
      />
    </div>
  );
}
```

### Option 2: Native Integration (Better UX)

For more control, integrate the receiver JavaScript directly into your app.

**Install dependencies:**

```bash
npm install @types/webrtc
```

**Create stream viewer component:**

```tsx
// components/NativeVRViewer.tsx
import { useEffect, useRef, useState } from 'react';

interface StreamStats {
  bitrate: number;
  fps: number;
  resolution: string;
}

export function NativeVRViewer({ 
  sessionId, 
  authToken, 
  backendUrl 
}: VRStreamViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  useEffect(() => {
    let renderStreaming: any;
    let recorder: any;
    
    async function connect() {
      try {
        // Import the render streaming module
        const { RenderStreaming, WebSocketSignaling } = await import('../js/renderstreaming.js');
        
        // Configure WebSocket with auth
        const signaling = new WebSocketSignaling();
        signaling.url = `${backendUrl}?token=${authToken}`;
        
        // Configure WebRTC
        const config = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // TURN servers will be fetched from backend
          ]
        };
        
        renderStreaming = new RenderStreaming(signaling, config);
        
        renderStreaming.onConnect = () => {
          setIsConnected(true);
          console.log('Connected to stream');
        };
        
        renderStreaming.onDisconnect = async () => {
          setIsConnected(false);
          
          // Stop recording
          if (recorder) {
            setIsRecording(false);
            await recorder.stop();
          }
        };
        
        renderStreaming.onTrackEvent = async (event: any) => {
          if (videoRef.current && event.track.kind === 'video') {
            const stream = new MediaStream([event.track]);
            videoRef.current.srcObject = stream;
            
            // Start recording
            if (typeof StreamRecorder !== 'undefined') {
              const { default: StreamRecorder } = await import('../js/recorder.js');
              recorder = new StreamRecorder(stream, sessionId, backendUrl, authToken);
              recorder.start();
              setIsRecording(true);
            }
          }
        };
        
        await renderStreaming.start();
        await renderStreaming.createConnection();
        
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    }
    
    connect();
    
    return () => {
      if (renderStreaming) {
        renderStreaming.stop();
      }
      if (recorder) {
        recorder.stop();
      }
    };
  }, [sessionId, authToken, backendUrl]);
  
  return (
    <div className="native-vr-viewer">
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: 'auto' }}
      />
      
      <div className="stream-controls">
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Live' : '⚫ Disconnected'}
        </div>
        
        {isRecording && (
          <div className="recording-indicator">
            🔴 Recording
          </div>
        )}
        
        {stats && (
          <div className="stream-stats">
            <span>{stats.resolution}</span>
            <span>{stats.fps} FPS</span>
            <span>{(stats.bitrate / 1000).toFixed(1)} Mbps</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Part 3: Stream Discovery

Display list of active streams in your app:

```tsx
// components/ActiveStreams.tsx
import { useEffect, useState } from 'react';

interface ActiveStream {
  id: string;
  user_id: string;
  room_name: string;
  started_at: string;
}

export function ActiveStreams({ authToken, backendUrl }: { authToken: string; backendUrl: string }) {
  const [streams, setStreams] = useState<ActiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchStreams() {
      try {
        const response = await fetch(`${backendUrl}/api/sessions/active`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const data = await response.json();
        setStreams(data);
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStreams();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [authToken, backendUrl]);
  
  if (loading) return <div>Loading streams...</div>;
  
  if (streams.length === 0) {
    return <div>No active streams</div>;
  }
  
  return (
    <div className="active-streams">
      <h2>Live Streams</h2>
      {streams.map(stream => (
        <div key={stream.id} className="stream-card">
          <h3>{stream.user_id}</h3>
          <p>Started: {new Date(stream.started_at).toLocaleTimeString()}</p>
          <button onClick={() => window.location.href = `/watch/${stream.id}`}>
            Watch Live
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Part 4: Recording Playback

Display recorded sessions:

```tsx
// components/RecordingsList.tsx
import { useEffect, useState } from 'react';

interface Recording {
  id: string;
  session_id: string;
  storage_url: string;
  file_size: number;
  created_at: string;
}

export function RecordingsList({ 
  sessionId, 
  authToken, 
  backendUrl 
}: { 
  sessionId: string;
  authToken: string;
  backendUrl: string;
}) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  
  useEffect(() => {
    async function fetchRecordings() {
      const response = await fetch(
        `${backendUrl}/api/recordings/session/${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      const data = await response.json();
      setRecordings(data);
    }
    
    fetchRecordings();
  }, [sessionId, authToken, backendUrl]);
  
  async function getDownloadUrl(recordingId: string) {
    const response = await fetch(
      `${backendUrl}/api/recordings/${recordingId}/download`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    const data = await response.json();
    return data.url;
  }
  
  return (
    <div className="recordings-list">
      <h3>Recordings</h3>
      {recordings.map(recording => (
        <div key={recording.id} className="recording-item">
          <div className="recording-info">
            <p>Size: {(recording.file_size / 1024 / 1024).toFixed(2)} MB</p>
            <p>Created: {new Date(recording.created_at).toLocaleString()}</p>
          </div>
          <button onClick={async () => {
            const url = await getDownloadUrl(recording.id);
            window.open(url, '_blank');
          }}>
            Download
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Part 5: Parent Notifications

### Backend Integration Required

You'll need to connect the streaming backend to your main app's user database to get parent emails.

#### Option A: Shared Database

If both apps use the same database:

```typescript
// In WebappBackend/src/routes/sessions.ts

import { mainAppDb } from '../db/mainAppConnection';

// In session start endpoint:
const user = await mainAppDb.users.findOne({
  where: { id: userId },
  include: ['parent']
});

if (user && user.parent && user.parent.email) {
  const streamUrl = `${process.env.STREAM_VIEWER_URL}/watch/${roomName}`;
  await notifyStreamStarted(
    user.parent.email,
    user.name,
    streamUrl,
    data.id
  );
}
```

#### Option B: API Call to Main App

```typescript
// In WebappBackend/src/services/parentService.ts

export async function getParentEmail(userId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${process.env.MAIN_APP_URL}/api/users/${userId}/parent`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MAIN_APP_API_KEY}`
        }
      }
    );
    
    const data = await response.json();
    return data.parentEmail;
  } catch (error) {
    console.error('Failed to get parent email:', error);
    return null;
  }
}
```

Then use in session routes:

```typescript
import { getParentEmail } from '../services/parentService';

// In session start:
const parentEmail = await getParentEmail(userId);
if (parentEmail) {
  await notifyStreamStarted(parentEmail, userName, streamUrl, sessionId);
}
```

---

## Part 6: Complete Page Example

Here's a complete stream viewer page for your app:

```tsx
// pages/StreamViewer.tsx
import { useState, useEffect } from 'react';
import { VRStreamViewer } from '../components/VRStreamViewer';
import { RecordingsList } from '../components/RecordingsList';
import { useAuth } from '../hooks/useAuth';

export function StreamViewerPage() {
  const { user, token } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  
  const BACKEND_URL = process.env.REACT_APP_STREAMING_BACKEND_URL || 'https://your-backend.up.railway.app';
  
  // Get session ID from URL or create new one
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('session');
    if (id) {
      setSessionId(id);
    }
  }, []);
  
  return (
    <div className="stream-viewer-page">
      <h1>VR Stream Viewer</h1>
      
      {sessionId && !streamEnded ? (
        <>
          <VRStreamViewer 
            sessionId={sessionId}
            authToken={token}
            backendUrl={BACKEND_URL}
          />
          
          <div className="stream-info">
            <p>Session ID: {sessionId}</p>
            <p>Viewer: {user.name}</p>
          </div>
        </>
      ) : (
        <div className="no-stream">
          <p>No active stream</p>
          <a href="/streams">Browse Active Streams</a>
        </div>
      )}
      
      {streamEnded && sessionId && (
        <div className="recordings-section">
          <h2>Stream Ended</h2>
          <p>Recording will be available shortly.</p>
          <RecordingsList 
            sessionId={sessionId}
            authToken={token}
            backendUrl={BACKEND_URL}
          />
        </div>
      )}
    </div>
  );
}
```

---

## Part 7: Environment Configuration

Add to your main web app's `.env`:

```bash
# Streaming Backend
REACT_APP_STREAMING_BACKEND_URL=https://your-backend.up.railway.app

# Same JWT secret as streaming backend
JWT_SECRET=your-shared-jwt-secret

# For API calls to streaming backend
STREAMING_BACKEND_API_KEY=optional-api-key-for-backend-to-backend
```

---

## Part 8: API Integration Helper

Create a helper service for all streaming API calls:

```typescript
// services/streamingApi.ts

const BACKEND_URL = process.env.REACT_APP_STREAMING_BACKEND_URL!;

export class StreamingAPI {
  constructor(private authToken: string) {}
  
  async getActiveSessions() {
    const response = await fetch(`${BACKEND_URL}/api/sessions/active`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });
    return response.json();
  }
  
  async getSession(sessionId: string) {
    const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });
    return response.json();
  }
  
  async getRecordings(sessionId: string) {
    const response = await fetch(
      `${BACKEND_URL}/api/recordings/session/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );
    return response.json();
  }
  
  async getRecordingDownloadUrl(recordingId: string) {
    const response = await fetch(
      `${BACKEND_URL}/api/recordings/${recordingId}/download`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );
    const data = await response.json();
    return data.url;
  }
  
  async trackViewer(sessionId: string) {
    const response = await fetch(
      `${BACKEND_URL}/api/sessions/${sessionId}/viewers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }
}

// Usage in components:
// const api = new StreamingAPI(authToken);
// const streams = await api.getActiveSessions();
```

---

## Part 9: URL Parameters

The receiver page accepts these parameters:

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `session` | No | Session ID to track | `?session=abc123` |
| `token` | Yes (production) | Auth token | `?token=eyJxxx` |
| `record` | No | Enable recording (default: true) | `?record=false` |

Example URL:
```
https://your-backend.up.railway.app/receiver?session=abc123&token=eyJxxx&record=true
```

---

## Part 10: Testing Integration

### Test Flow

1. **User logs into your main app**
   - Gets JWT token from your auth system

2. **User launches VR experience**
   - Unity app receives auth token
   - Token stored in PlayerPrefs

3. **User starts streaming in VR**
   - Unity calls `/api/sessions/start`
   - Backend creates session in database
   - Backend sends email to parent

4. **Parent clicks link in email**
   - Opens viewer page with session ID
   - Viewer authenticates with JWT
   - Starts receiving stream
   - Recording begins automatically

5. **User stops streaming**
   - Unity calls `/api/sessions/end`
   - Recording uploads to S3
   - Backend sends "recording ready" email

### Test Checklist

- [ ] JWT token flows from main app → Unity
- [ ] Unity can create sessions via API
- [ ] Viewer can watch stream with auth
- [ ] Recording starts automatically
- [ ] Recording uploads successfully
- [ ] Parent receives both emails
- [ ] Recordings are playable
- [ ] Security: can't access without auth

---

## Part 11: Security Considerations

### Cross-Site Issues

If streaming backend is on different domain:

```typescript
// Main app sends token via postMessage
const iframe = document.querySelector('iframe');
iframe.contentWindow.postMessage(
  { type: 'auth', token: authToken },
  'https://streaming-backend.com'
);

// Receiver page listens for message
window.addEventListener('message', (event) => {
  if (event.origin === 'https://your-main-app.com') {
    if (event.data.type === 'auth') {
      // Use token for authentication
      setupStreamingWithToken(event.data.token);
    }
  }
});
```

### Token Refresh

Handle token expiration:

```typescript
// In your main app
async function getStreamingToken() {
  // Generate short-lived token specifically for streaming
  const response = await fetch('/api/streaming/token', {
    headers: {
      'Authorization': `Bearer ${mainAuthToken}`
    }
  });
  
  const data = await response.json();
  return data.streamingToken; // Expires in 24 hours
}
```

---

## Part 12: Styling the Viewer

Example CSS for embedded viewer:

```css
.vr-stream-container {
  position: relative;
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.stream-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 15px;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status.connected {
  color: #4caf50;
  font-weight: bold;
}

.recording-indicator {
  color: #f44336;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.stream-stats {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #aaa;
}
```

---

## Part 13: Mobile Responsiveness

Make sure viewer works on parent's phones:

```tsx
// Add mobile detection
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

<VRStreamViewer
  sessionId={sessionId}
  authToken={token}
  backendUrl={BACKEND_URL}
  quality={isMobile ? 'medium' : 'high'} // Reduce quality on mobile
  muted={isMobile} // Start muted on mobile (autoplay requirement)
/>
```

---

## Summary

**What you need to do:**

1. **In Unity:** Pass auth token via deep link or PlayerPrefs
2. **In Web App:** Create viewer component with iframe or native integration
3. **For Parents:** Get parent email and connect to notification system
4. **For Security:** Ensure JWT secret is shared between apps
5. **For UX:** Add stream discovery and recording playback

**All backend APIs are ready** - just need to integrate from your frontend! 🚀

