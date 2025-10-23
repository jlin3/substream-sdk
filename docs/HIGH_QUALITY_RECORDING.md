# High-Quality Recording Guide

## Current vs. Optimal Recording

### Current Setup (Browser Recording)
```
Unity → WebRTC (compressed) → Browser → MediaRecorder → GCS
Quality: Good (compressed)
Audio: Opus 128kbps
Video: VP8/VP9 3Mbps
Resolution: Up to 1080p
```

**Pros:** Simple, automatic, no Unity changes needed  
**Cons:** Double compression, quality loss

### Optimal Setup (Unity Recording)
```
Unity → Unity Recorder (uncompressed) → H.264 → GCS
       ↓
       WebRTC (for live viewing)
       
Quality: Excellent (minimal compression)
Audio: AAC 256kbps
Video: H.264 10-20Mbps
Resolution: Up to 4K
```

**Pros:** Highest quality, separate from streaming  
**Cons:** Requires Unity Recorder package, more storage

---

## 🎯 Recommended: Dual Recording System

Record **twice** for best results:

1. **High-quality local recording** (Unity Recorder) - for storage
2. **Compressed stream** (WebRTC) - for live viewing

This gives you:
- ✅ Perfect quality recordings
- ✅ Live streaming still works
- ✅ Parents can watch live AND get HD recording later

---

## Implementation: Unity Recorder

### Step 1: Install Unity Recorder Package

1. Open Unity
2. Window → Package Manager
3. Click `+` → Add package by name
4. Enter: `com.unity.recorder`
5. Click Add

### Step 2: Add Recording Script

**File:** `UnityProject/Assets/Scripts/UnityRecorderControl.cs`

```csharp
using System;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;
using UnityRecorder;
using UnityRecorder.Input;

public class UnityRecorderControl : MonoBehaviour
{
    [Header("Recording Settings")]
    public string backendUrl = "https://your-backend.com";
    public string authToken = "";
    
    [Header("Quality Settings")]
    public int videoWidth = 1920;  // Or 3840 for 4K
    public int videoHeight = 1080; // Or 2160 for 4K
    public int frameRate = 60;     // Higher than stream (30fps)
    public int bitrate = 15000000; // 15 Mbps for excellent quality
    
    private RecorderController recorderController;
    private string currentRecordingPath;
    private string currentSessionId;
    private bool isRecording = false;
    
    void Start()
    {
        SetupRecorder();
    }
    
    private void SetupRecorder()
    {
        var controllerSettings = ScriptableObject.CreateInstance<RecorderControllerSettings>();
        recorderController = new RecorderController(controllerSettings);
        
        // Create movie recorder settings
        var videoRecorder = ScriptableObject.CreateInstance<MovieRecorderSettings>();
        videoRecorder.name = "VR Recording";
        videoRecorder.Enabled = true;
        
        // Video input (from camera)
        var cameraInput = new CameraInputSettings
        {
            Source = ImageSource.MainCamera,
            OutputWidth = videoWidth,
            OutputHeight = videoHeight,
            CaptureUI = false,
            FlipFinalOutput = false
        };
        videoRecorder.ImageInputSettings = cameraInput;
        
        // Audio input
        var audioInput = new AudioInputSettings
        {
            PreserveAudio = true
        };
        videoRecorder.AudioInputSettings = audioInput;
        
        // Output settings
        videoRecorder.OutputFormat = MovieRecorderSettings.VideoRecorderOutputFormat.MP4;
        videoRecorder.VideoBitRateMode = VideoBitrateMode.High;
        
        // H.264 encoding (best quality/compatibility)
        var encoderSettings = new CoreEncoderSettings
        {
            EncodingQuality = CoreEncoderSettings.VideoEncodingQuality.High,
            Codec = CoreEncoderSettings.OutputCodec.H264
        };
        videoRecorder.EncoderSettings = encoderSettings;
        
        // Frame rate
        videoRecorder.FrameRate = frameRate;
        videoRecorder.FrameRatePlayback = FrameRatePlayback.Constant;
        
        // Output file
        videoRecorder.OutputFile = new OutputPath
        {
            Root = OutputPath.EOutputPathRoot.PersistentData,
            Leaf = "Recordings/recording_<SessionId>_<Take>"
        };
        
        // Add to controller
        controllerSettings.AddRecorderSettings(videoRecorder);
        controllerSettings.SetRecordModeToManual();
        controllerSettings.FrameRate = frameRate;
        
        recorderController.Settings = controllerSettings;
        recorderController.PrepareRecording();
    }
    
    public void StartRecording(string sessionId)
    {
        if (isRecording)
        {
            Debug.LogWarning("Already recording!");
            return;
        }
        
        currentSessionId = sessionId;
        
        // Start Unity Recorder
        recorderController.StartRecording();
        isRecording = true;
        
        Debug.Log($"✅ High-quality recording started for session: {sessionId}");
        Debug.Log($"   Resolution: {videoWidth}x{videoHeight}");
        Debug.Log($"   Frame Rate: {frameRate} fps");
        Debug.Log($"   Bitrate: {bitrate / 1000000} Mbps");
    }
    
    public async void StopRecording()
    {
        if (!isRecording)
        {
            Debug.LogWarning("Not recording!");
            return;
        }
        
        // Stop recorder
        recorderController.StopRecording();
        isRecording = false;
        
        // Wait for file to be written
        await System.Threading.Tasks.Task.Delay(2000);
        
        // Find the recorded file
        string recordingsPath = Path.Combine(Application.persistentDataPath, "Recordings");
        string[] files = Directory.GetFiles(recordingsPath, $"*{currentSessionId}*.mp4");
        
        if (files.Length > 0)
        {
            currentRecordingPath = files[0];
            Debug.Log($"✅ Recording saved: {currentRecordingPath}");
            
            // Upload to backend
            StartCoroutine(UploadRecording(currentRecordingPath, currentSessionId));
        }
        else
        {
            Debug.LogError("Recording file not found!");
        }
    }
    
    private IEnumerator UploadRecording(string filePath, string sessionId)
    {
        Debug.Log($"📤 Uploading recording: {filePath}");
        
        // Read file
        byte[] fileBytes = File.ReadAllBytes(filePath);
        float fileSizeMB = fileBytes.Length / 1024f / 1024f;
        
        Debug.Log($"   File size: {fileSizeMB:F2} MB");
        
        // Upload to backend
        WWWForm form = new WWWForm();
        form.AddBinaryData("recording", fileBytes, Path.GetFileName(filePath), "video/mp4");
        form.AddField("sessionId", sessionId);
        
        using (UnityWebRequest request = UnityWebRequest.Post($"{backendUrl}/api/recordings/upload", form))
        {
            request.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            // Track upload progress
            var operation = request.SendWebRequest();
            
            while (!operation.isDone)
            {
                Debug.Log($"Upload progress: {operation.progress * 100:F1}%");
                yield return new WaitForSeconds(0.5f);
            }
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("✅ Recording uploaded successfully!");
                
                var response = JsonUtility.FromJson<UploadResponse>(request.downloadHandler.text);
                Debug.Log($"   URL: {response.url}");
                
                // Delete local file to save space
                File.Delete(filePath);
                Debug.Log("   Local file cleaned up");
            }
            else
            {
                Debug.LogError($"❌ Upload failed: {request.error}");
            }
        }
    }
    
    [Serializable]
    private class UploadResponse
    {
        public string id;
        public string url;
        public int fileSize;
    }
}
```

### Step 3: Integrate with RenderStreamControl

```csharp
// In RenderStreamControl.cs
private UnityRecorderControl recorder;

void Start()
{
    // ... existing setup
    recorder = GetComponent<UnityRecorderControl>();
    if (recorder == null)
    {
        recorder = gameObject.AddComponent<UnityRecorderControl>();
    }
}

private void StartStreaming()
{
    // ... existing code
    
    // Start high-quality recording
    if (recorder != null && !string.IsNullOrEmpty(currentSessionId))
    {
        recorder.StartRecording(currentSessionId);
    }
}

private IEnumerator StopStreamingCoroutine()
{
    // Stop high-quality recording
    if (recorder != null)
    {
        recorder.StopRecording();
    }
    
    // ... rest of existing code
}
```

---

## 🎵 Audio Recording Details

### Current Audio Setup

**Unity → WebRTC:**
- AudioStreamSender captures microphone/game audio
- Encodes to Opus codec @ 128kbps
- Sent alongside video in WebRTC stream
- Browser receives and plays

**In Recording:**
- Browser MediaRecorder captures video + audio together
- Audio stays at Opus 128kbps
- Synchronized with video automatically

### High-Quality Audio with Unity Recorder

**Unity Recorder captures:**
- All AudioListener output (game sounds, music, voice)
- Encodes to AAC @ 256kbps (better than Opus 128kbps)
- Perfectly synchronized with high-quality video
- No network compression

**Configuration:**
```csharp
var audioInput = new AudioInputSettings
{
    PreserveAudio = true,
    RecordAudio = true,
    AudioQuality = CoreEncoderSettings.AudioQuality.High  // 256kbps AAC
};
```

---

## 📊 Quality Comparison

### Browser Recording (Current)
| Aspect | Quality | Notes |
|--------|---------|-------|
| Video Codec | VP8/VP9 | Good compression |
| Video Bitrate | 3 Mbps | Network-optimized |
| Audio Codec | Opus | Efficient for streaming |
| Audio Bitrate | 128 kbps | Standard quality |
| Resolution | Up to 1080p | Limited by stream |
| Frame Rate | 30 fps | Stream FPS |
| File Size | ~1.3 GB/hour | Reasonable |
| **Overall** | **Good** | Best for live + recording |

### Unity Recorder (Recommended for Quality)
| Aspect | Quality | Notes |
|--------|---------|-------|
| Video Codec | H.264 | Industry standard |
| Video Bitrate | 10-20 Mbps | Excellent quality |
| Audio Codec | AAC | High fidelity |
| Audio Bitrate | 256 kbps | CD-like quality |
| Resolution | Up to 4K | Native capture |
| Frame Rate | Up to 120 fps | Smooth |
| File Size | ~5-9 GB/hour | Much larger |
| **Overall** | **Excellent** | Best for archival |

### Dual Recording (BEST)
| Stream | Recording | Notes |
|--------|-----------|-------|
| VP8 3Mbps | H.264 15Mbps | Best of both |
| 1080p 30fps | 1080p 60fps | Smoother recording |
| Opus 128kbps | AAC 256kbps | Better audio |
| ~1.3GB/hr | ~6GB/hr | Manageable |
| **Live viewing** | **Archive quality** | Optimal solution |

---

## 🎯 Recommended Configuration

### For Your Use Case (Parent Viewing)

**During Stream (Live):**
- WebRTC: 1080p @ 30fps, 3Mbps (current setup ✅)
- Audio: Opus 128kbps
- **Purpose:** Real-time parent viewing with minimal lag

**Recording (Archive):**
- Unity Recorder: 1080p @ 60fps, 15Mbps
- Audio: AAC 256kbps
- **Purpose:** High-quality playback later

**Storage:**
- Live stream recording: ~1.3 GB/hour
- High-quality recording: ~6 GB/hour
- **Total:** ~7.3 GB/hour per session

**Cost (GCS):**
- Storage: $0.02/GB/month
- 100 hours recorded: 730 GB = $14.60/month
- Very affordable!

---

## 🔧 Implementation Options

### Option A: Dual Recording (BEST)

**Pros:**
- ✅ Parents watch live (low latency)
- ✅ High-quality archive
- ✅ Best user experience

**Cons:**
- More storage (~7GB/hour vs 1.3GB/hour)
- Requires Unity Recorder package

**Code:** Use both `RenderStreamControl` (streaming) + `UnityRecorderControl` (recording)

---

### Option B: High-Quality Stream Recording

Increase WebRTC stream quality:

```csharp
// In RenderStreamControl.cs, update ConfigureVideoStreamSettings:

// Increase bitrate
videoStreamSender.SetBitrate(8000, 15000); // 8-15 Mbps instead of 3-8

// Increase resolution
videoStreamSender.SetTextureSize(new Vector2Int(1920, 1080));

// Increase frame rate
videoStreamSender.SetFrameRate(60f); // Instead of 30fps
```

**Then browser records at higher quality:**
```javascript
// In recorder.js
this.mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9,opus',  // VP9 is better than VP8
  videoBitsPerSecond: 10000000,  // 10 Mbps instead of 3
  audioBitsPerSecond: 256000     // 256 kbps instead of 128
});
```

**Pros:**
- ✅ Better quality recording
- ✅ No extra Unity package
- ✅ Single recording

**Cons:**
- Higher bandwidth (parents need fast internet)
- More expensive TURN server usage
- Still compressed for streaming

---

### Option C: Unity-Only Recording (Offline Storage)

Record in Unity, upload after session ends:

**Pros:**
- ✅ Highest possible quality
- ✅ No network bandwidth impact during streaming
- ✅ Parents don't need fast internet

**Cons:**
- ❌ No live recording (only after stream ends)
- Takes time to upload after session
- User must wait for upload

---

## 🎵 Audio Quality Details

### Current Audio Path

```
Unity Audio Sources
  ↓
AudioStreamSender (Unity)
  ↓
WebRTC Encoding (Opus 128kbps)
  ↓
Network transmission
  ↓
Browser receives
  ↓
MediaRecorder captures (Opus 128kbps)
  ↓
Saved to GCS
```

**Quality:** Good for voice, acceptable for music

### High-Quality Audio Path

```
Unity Audio Listener
  ↓
Unity Recorder captures raw audio
  ↓
AAC Encoding (256kbps)
  ↓
Saved to MP4 file
  ↓
Upload to GCS
```

**Quality:** Excellent for everything

### Audio Sources in Unity

Make sure you're capturing all audio:

```csharp
// In Unity Recorder settings
var audioInput = new AudioInputSettings
{
    PreserveAudio = true,
    RecordAudio = true,
    
    // Capture from AudioListener (gets all game audio)
    AudioSource = AudioInputSettings.EAudioSource.AudioListener
};
```

This captures:
- ✅ Game sound effects
- ✅ Background music  
- ✅ Voice chat (if using microphone)
- ✅ All mixed audio Unity outputs

---

## 💾 Storage Implications

### Current (Browser Recording Only)
- 1.3 GB/hour @ 1080p 30fps
- 100 hours = 130 GB = $2.60/month on GCS

### With High-Quality Unity Recording
- 6 GB/hour @ 1080p 60fps H.264
- 100 hours = 600 GB = $12/month on GCS

### Dual Recording
- 7.3 GB/hour total
- 100 hours = 730 GB = $14.60/month on GCS

**Still very affordable!**

---

## 🚀 My Recommendation

### For BookVid VR Streaming:

**Use Dual Recording:**

1. **Live Stream** (existing):
   - 1080p @ 30fps
   - 3 Mbps (works on slower connections)
   - Parents can watch live
   - Browser records this too (backup)

2. **High-Quality Recording** (add):
   - 1080p @ 60fps
   - 15 Mbps H.264
   - Unity Recorder
   - Upload after session
   - This is the "keeper" recording

**Why:**
- Parents get smooth live viewing
- You get amazing quality for archive
- Only $15/month extra storage cost
- Best user experience

---

## 📋 Next Steps to Add High-Quality Recording

1. **Install Unity Recorder package** (5 min)
2. **Add UnityRecorderControl.cs** (code above)
3. **Attach to same GameObject** as RenderStreamControl
4. **Test:** Record locally, verify quality
5. **Add upload** after session ends

**Total time:** 2-3 hours

**Quality improvement:** Huge! 

---

## 🎬 Complete Flow with Dual Recording

```
Kid starts streaming:
  ├─ RenderStreamControl starts WebRTC (3Mbps, 30fps)
  │    ↓
  │    Parent watches live in browser
  │    ↓
  │    Browser records stream (backup quality)
  │
  └─ UnityRecorderControl starts Unity Recorder (15Mbps, 60fps)
       ↓
       Records to local file
       ↓
       
Kid stops streaming:
  ├─ WebRTC stream ends
  │    ↓
  │    Browser uploads recording to GCS (1.3GB)
  │
  └─ Unity Recorder stops
       ↓
       Upload HD file to GCS (6GB)
       ↓
       Parent gets email: "Recording ready!"
```

**Result:**
- ✅ Parent watched live
- ✅ Browser recording (good quality, fast)
- ✅ Unity recording (excellent quality, best)
- ✅ Two versions: quick access + archival quality

---

## 🔧 Quick Implementation

Want me to:
1. Add Unity Recorder integration to `RenderStreamControl.cs`?
2. Update backend to handle larger MP4 uploads?
3. Add quality selection (let users choose quality)?

Let me know and I'll implement it! 🚀

