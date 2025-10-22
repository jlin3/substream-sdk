# Sending Game Data to Web App

## Overview

Beyond video/audio streaming, you can send real-time game data to your web app using:
1. **WebRTC Data Channels** (low latency, peer-to-peer)
2. **REST API** (for non-time-sensitive data)
3. **WebSocket Messages** (through signaling server)

## Method 1: WebRTC Data Channels (Recommended)

### **Use For:** Real-time game state, player actions, scores
### **Latency:** 10-50ms
### **Bandwidth:** Minimal

### Unity Implementation

```csharp
using Unity.RenderStreaming;
using UnityEngine;
using System.Text;

public class GameDataSender : MonoBehaviour
{
    private RTCDataChannel dataChannel;
    private Broadcast broadcast;
    
    void Start()
    {
        broadcast = GetComponent<Broadcast>();
        
        // Subscribe to connection events
        broadcast.OnStartedConnection += OnConnectionStarted;
    }
    
    private void OnConnectionStarted(string connectionId)
    {
        Debug.Log($"Creating data channel for connection: {connectionId}");
        
        // Create data channel for game data
        dataChannel = broadcast.CreateDataChannel(connectionId, "gamedata");
        
        if (dataChannel != null)
        {
            dataChannel.OnOpen = () => {
                Debug.Log("Game data channel opened!");
            };
            
            Debug.Log("Data channel created successfully");
        }
    }
    
    // Send game state updates
    public void SendGameState(GameState state)
    {
        if (dataChannel == null || dataChannel.ReadyState != RTCDataChannelState.Open)
        {
            Debug.LogWarning("Data channel not ready");
            return;
        }
        
        string json = JsonUtility.ToJson(state);
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        dataChannel.Send(bytes);
    }
    
    // Example: Send score update
    public void SendScoreUpdate(int score)
    {
        var update = new {
            type = "score",
            value = score,
            timestamp = System.DateTime.UtcNow.ToString("o")
        };
        
        string json = JsonUtility.ToJson(update);
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        dataChannel.Send(bytes);
    }
    
    // Example: Send player position
    public void SendPlayerPosition(Vector3 position)
    {
        var update = new {
            type = "position",
            x = position.x,
            y = position.y,
            z = position.z,
            timestamp = System.DateTime.UtcNow.ToString("o")
        };
        
        string json = JsonUtility.ToJson(update);
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        dataChannel.Send(bytes);
    }
    
    void Update()
    {
        // Send updates every frame or on specific events
        if (dataChannel != null && dataChannel.ReadyState == RTCDataChannelState.Open)
        {
            // Example: Send position every 100ms
            if (Time.frameCount % 6 == 0) // ~60fps / 6 = 10 updates/sec
            {
                SendPlayerPosition(transform.position);
            }
        }
    }
}

[System.Serializable]
public class GameState
{
    public int score;
    public int level;
    public float health;
    public string playerName;
    public Vector3 position;
    public string[] inventory;
}
```

### Web App Implementation (JavaScript)

```javascript
// In your receiver page JS
let gameDataChannel = null;
let currentGameState = {};

// When WebRTC connection is established
renderstreaming.onDataChannel = (channel) => {
  if (channel.label === 'gamedata') {
    gameDataChannel = channel;
    
    gameDataChannel.onopen = () => {
      console.log('Game data channel opened!');
    };
    
    gameDataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleGameData(data);
    };
  }
};

function handleGameData(data) {
  switch(data.type) {
    case 'score':
      updateScoreDisplay(data.value);
      break;
    case 'position':
      updatePlayerPosition(data.x, data.y, data.z);
      break;
    case 'gamestate':
      updateGameState(data);
      break;
    default:
      console.log('Unknown game data:', data);
  }
}

function updateScoreDisplay(score) {
  document.getElementById('score').textContent = score;
  currentGameState.score = score;
}

function updatePlayerPosition(x, y, z) {
  // Update 2D minimap or display coordinates
  const minimap = document.getElementById('minimap');
  // Convert 3D position to 2D minimap coordinates
  updateMinimap(minimap, x, z);
}

function updateGameState(state) {
  currentGameState = { ...currentGameState, ...state };
  
  // Update React/Vue component
  if (window.gameStateCallback) {
    window.gameStateCallback(currentGameState);
  }
}
```

### React Integration

```jsx
import { useState, useEffect } from 'react';

function GameOverlay({ renderStreaming }) {
  const [gameState, setGameState] = useState({
    score: 0,
    level: 1,
    health: 100,
    position: { x: 0, y: 0, z: 0 }
  });

  useEffect(() => {
    if (!renderStreaming) return;

    renderStreaming.onDataChannel = (channel) => {
      if (channel.label === 'gamedata') {
        channel.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'gamestate') {
            setGameState(prev => ({ ...prev, ...data }));
          } else if (data.type === 'score') {
            setGameState(prev => ({ ...prev, score: data.value }));
          } else if (data.type === 'position') {
            setGameState(prev => ({
              ...prev,
              position: { x: data.x, y: data.y, z: data.z }
            }));
          }
        };
      }
    };
  }, [renderStreaming]);

  return (
    <div className="game-overlay">
      <div className="stats">
        <div>Score: {gameState.score}</div>
        <div>Level: {gameState.level}</div>
        <div>Health: {gameState.health}%</div>
      </div>
      <div className="minimap">
        Position: ({gameState.position.x.toFixed(1)}, 
                   {gameState.position.z.toFixed(1)})
      </div>
    </div>
  );
}
```

## Method 2: REST API (For Metadata)

### **Use For:** Session info, achievements, persistent data
### **Latency:** 100-500ms

### Unity Implementation

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class GameMetadataAPI : MonoBehaviour
{
    private string apiUrl = "https://your-backend.com/api";
    private string authToken;
    
    public IEnumerator UpdateSessionMetadata(string sessionId, object metadata)
    {
        string json = JsonUtility.ToJson(metadata);
        
        using (UnityWebRequest request = new UnityWebRequest(
            $"{apiUrl}/stream/metadata/{sessionId}", 
            "PUT"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("Metadata updated successfully");
            }
            else
            {
                Debug.LogError($"Failed to update metadata: {request.error}");
            }
        }
    }
    
    // Example: Send achievement unlock
    public void UnlockAchievement(string achievementId)
    {
        var data = new {
            type = "achievement",
            achievementId = achievementId,
            timestamp = System.DateTime.UtcNow
        };
        
        StartCoroutine(UpdateSessionMetadata(currentSessionId, data));
    }
}
```

## Method 3: WebSocket Through Signaling Server

### **Use For:** Coordinating between multiple viewers, chat

### Unity Implementation

```csharp
// Send custom message through signaling connection
public class SignalingMessenger : MonoBehaviour
{
    public void SendCustomMessage(string message)
    {
        // This would require modifying the signaling protocol
        var msg = new {
            type = "custom",
            data = message
        };
        
        // Send through existing signaling connection
        // (requires backend support)
    }
}
```

## Performance Considerations

### **Data Channel Best Practices:**

1. **Batch Updates**
```csharp
// Instead of sending every frame
List<Update> updates = new List<Update>();

void Update()
{
    updates.Add(new Update { ... });
    
    if (Time.frameCount % 6 == 0) // Send 10 times/sec
    {
        SendBatch(updates);
        updates.Clear();
    }
}
```

2. **Compress Large Payloads**
```csharp
using System.IO.Compression;

byte[] CompressData(string json)
{
    byte[] bytes = Encoding.UTF8.GetBytes(json);
    using (var output = new MemoryStream())
    {
        using (var gzip = new GZipStream(output, CompressionMode.Compress))
        {
            gzip.Write(bytes, 0, bytes.Length);
        }
        return output.ToArray();
    }
}
```

3. **Send Only Deltas**
```csharp
// Only send what changed
if (currentScore != lastSentScore)
{
    SendScoreUpdate(currentScore);
    lastSentScore = currentScore;
}
```

## Example: Complete Game State System

```csharp
public class GameStateSync : MonoBehaviour
{
    [System.Serializable]
    public class FullGameState
    {
        public int score;
        public int level;
        public float health;
        public Vector3 position;
        public List<string> activeQuests;
        public Dictionary<string, int> inventory;
    }
    
    private RTCDataChannel dataChannel;
    private FullGameState lastSentState;
    private float syncInterval = 0.1f; // 10 times per second
    private float lastSyncTime;
    
    void Update()
    {
        if (Time.time - lastSyncTime >= syncInterval)
        {
            SyncGameState();
            lastSyncTime = Time.time;
        }
    }
    
    void SyncGameState()
    {
        var currentState = GetCurrentGameState();
        
        // Only send if something changed
        if (HasStateChanged(currentState, lastSentState))
        {
            SendGameState(currentState);
            lastSentState = currentState;
        }
    }
    
    FullGameState GetCurrentGameState()
    {
        return new FullGameState {
            score = GameManager.instance.score,
            level = GameManager.instance.level,
            health = PlayerController.instance.health,
            position = PlayerController.instance.transform.position,
            // ... other fields
        };
    }
    
    bool HasStateChanged(FullGameState current, FullGameState last)
    {
        if (last == null) return true;
        
        return current.score != last.score ||
               current.level != last.level ||
               Vector3.Distance(current.position, last.position) > 0.5f;
               // ... check other fields
    }
}
```

## Testing Data Channels

### Chrome DevTools
1. Open receiver page
2. Press F12 → Console
3. Type: `renderstreaming.getDataChannels()`
4. Monitor incoming messages

### Unity Testing
```csharp
#if UNITY_EDITOR
[ContextMenu("Test Send Data")]
void TestSendData()
{
    SendGameState(new GameState {
        score = 12345,
        level = 99,
        health = 50.0f
    });
}
#endif
```

## Troubleshooting

**Data channel not opening?**
- Check if WebRTC connection is established first
- Verify data channel is created AFTER connection
- Check browser console for errors

**Messages not received?**
- Verify channel label matches on both sides
- Check message size (max ~256KB per message)
- Ensure JSON is valid

**High latency?**
- Reduce send frequency
- Batch multiple updates
- Send deltas instead of full state

