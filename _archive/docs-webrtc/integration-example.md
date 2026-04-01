# Web App Integration Guide

## Embedding Stream in Your React/Vue/Angular App

### Option 1: iframe Embed (Simplest)
```html
<iframe 
  src="https://your-backend.com/receiver/?streamId=user123"
  width="1920" 
  height="1080"
  allow="camera; microphone; autoplay"
></iframe>
```

### Option 2: Direct Integration (Recommended)

#### React Component Example
```jsx
import { useEffect, useRef } from 'react';
import { RenderStreaming, WebSocketSignaling } from './renderstreaming';

function VRStreamViewer({ streamId, userId }) {
  const videoRef = useRef(null);
  const renderStreamingRef = useRef(null);

  useEffect(() => {
    const initStream = async () => {
      // Get auth token from your backend
      const token = await fetch('/api/stream/token', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userToken}` }
      }).then(r => r.json());

      // Initialize WebRTC streaming
      const signaling = new WebSocketSignaling({
        url: 'wss://your-backend.com',
        token: token.streamToken
      });

      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { 
            urls: 'turn:your-turn-server.com:3478',
            username: 'user',
            credential: 'pass'
          }
        ]
      };

      renderStreamingRef.current = new RenderStreaming(signaling, config);
      
      renderStreamingRef.current.onTrackEvent = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      await renderStreamingRef.current.start();
      await renderStreamingRef.current.createConnection(streamId);
    };

    initStream();

    return () => {
      if (renderStreamingRef.current) {
        renderStreamingRef.current.stop();
      }
    };
  }, [streamId, userId]);

  return (
    <div className="vr-stream-container">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={false}
        style={{ width: '100%', height: 'auto' }}
      />
      <div className="stream-info">
        Viewing VR Stream: {streamId}
      </div>
    </div>
  );
}
```

## Backend API Endpoints Needed

### 1. Stream Session Management
```typescript
// Create streaming session
POST /api/stream/session
{
  "userId": "user123",
  "gameId": "game456"
}
Response: {
  "sessionId": "session789",
  "streamToken": "jwt-token",
  "expiresAt": "2025-10-23T12:00:00Z"
}

// Get active streams
GET /api/stream/active
Response: [
  {
    "sessionId": "session789",
    "userId": "user123",
    "userName": "Jesse",
    "startedAt": "2025-10-22T10:00:00Z",
    "viewers": 3
  }
]

// Join stream as viewer
POST /api/stream/join/{sessionId}
Response: {
  "viewerToken": "jwt-token",
  "streamUrl": "wss://your-backend.com/signaling"
}
```

### 2. Stream Metadata
```typescript
// Update stream metadata from Unity
POST /api/stream/metadata
{
  "sessionId": "session789",
  "gameState": {
    "level": 5,
    "score": 1000,
    "position": { "x": 10, "y": 5, "z": 3 }
  }
}

// Get stream metadata (for viewers)
GET /api/stream/metadata/{sessionId}
```

## Unity Integration

### Send Custom Data to Web App
```csharp
// In RenderStreamControl.cs
public class StreamMetadata
{
    public string sessionId;
    public int level;
    public int score;
    public Vector3 playerPosition;
}

private void SendMetadataToServer()
{
    var metadata = new StreamMetadata {
        sessionId = currentSessionId,
        level = GameManager.instance.currentLevel,
        score = GameManager.instance.score,
        playerPosition = player.transform.position
    };
    
    StartCoroutine(PostMetadata(metadata));
}

private IEnumerator PostMetadata(StreamMetadata data)
{
    string json = JsonUtility.ToJson(data);
    using (UnityWebRequest request = UnityWebRequest.Post(
        "https://your-backend.com/api/stream/metadata", 
        json, 
        "application/json"))
    {
        yield return request.SendWebRequest();
        
        if (request.result != UnityWebRequest.Result.Success) {
            Debug.LogError($"Failed to send metadata: {request.error}");
        }
    }
}
```

## Security Considerations

1. **Validate tokens on signaling server**
2. **Enforce viewer limits per stream**
3. **Implement rate limiting**
4. **Add CORS policies**
5. **Use HTTPS/WSS only**

## Performance Optimization

1. **Adaptive bitrate based on viewer count**
2. **Record streams for playback**
3. **Implement stream reconnection logic**
4. **Add quality selection UI**

