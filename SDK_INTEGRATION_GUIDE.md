# Unity Streaming SDK - Integration Guide

Quick guide for game developers to add VR streaming to their Unity game.

**Your game → Our streaming backend (already deployed)**

**Time to integrate: 15-20 minutes**

---

## 🎯 What This Does

Adds high-quality streaming (1080p @ 60fps) from your Unity VR game to web browsers:
- ✅ Parents/viewers can watch gameplay live
- ✅ Automatic recording to cloud
- ✅ Multi-viewer support
- ✅ Works on Quest, PCVR, any Unity platform

---

## 📦 Step 1: Add SDK to Your Game (5 minutes)

### Unity Version Compatibility

**Supported Unity Versions:**
- ✅ Unity 2022.3.x (LTS) - Fully supported
- ✅ Unity 2023.x - Fully supported  
- ✅ Unity 6+ - Full feature support including advanced quality controls

**Note:** The SDK is optimized to work across all Unity versions. Some advanced quality settings (SetFrameRate, SetBitrate) are only available in Unity 6+, but the SDK will automatically detect and use compatible alternatives on Unity 2022.3.x.

### Install Unity Render Streaming Package

1. Open your Unity project
2. Window → Package Manager
3. Click `+` → Add package by name
4. Enter: `com.unity.renderstreaming`
5. Click "Add" and wait for installation

### Copy SDK Script

1. Download `RenderStreamControl.cs` from this repo:
   ```
   UnityProject/Assets/Scripts/RenderStreamControl.cs
   ```

2. Copy it to your Unity project's `Assets/Scripts/` folder

---

## ⚙️ Step 2: Configure SDK (5 minutes)

### Add to Your Scene

1. Find your main camera or player object in the scene
2. Add Component → `RenderStreamControl`

### Configure in Inspector

**Required settings:**

- **Backend URL:** `https://your-backend.up.railway.app`  
  _(We'll provide this URL)_

- **Stream Bitrate:** `8000` (8 Mbps - high quality)

- **Stream Frame Rate:** `60` (smooth 60fps)

**Optional:**
- **Auth Token:** Leave empty for testing
- **Recording Text:** Drag a UI GameObject here to show "RECORDING" indicator

### Create Stream Settings Asset

1. Assets → Create → Render Streaming → Signaling Settings
2. Name it: `Stream-Settings`
3. Select it in Project window
4. In Inspector, set:
   - **WebSocket URL:** `wss://your-backend.up.railway.app`  
     _(We'll provide this)_
   - **ICE Servers:** Already configured ✅

---

## 🧪 Step 3: Test Streaming (5 minutes)

### In Unity Editor

1. Press Play
2. Press `L` key on keyboard
3. Check console - should see:
   ```
   ✅ HIGH QUALITY: 1920x1080, 60fps
   ✅ WebRTC Connection STARTED
   ```

### View the Stream

1. Open browser: `https://your-backend.up.railway.app/receiver/`
2. Click "Play" button
3. **You should see your Unity game streaming!** 🎉

---

## 📱 Step 4: Build for Quest (10 minutes)

### Build Settings

1. File → Build Settings
2. Platform: Android (for Quest)
3. Player Settings → Other Settings:
   - Minimum API Level: Android 10.0
   - Scripting Backend: IL2CPP
   - ARM64: ✅ Checked

4. Click "Build and Run" (or just "Build")

### Install on Quest

```bash
adb install -r YourGame.apk
```

### Test on Quest

1. Browser: Open `https://your-backend.up.railway.app/receiver/`
2. Click Play
3. Put on Quest
4. Launch your game
5. Press streaming button (or `L` key)
6. **Browser shows your VR view!** 🎉

---

## 🎮 Adding a Streaming Button (Optional)

### Create UI Button

Instead of pressing `L` key, add a proper button:

```csharp
// In your game's UI script
using UnityEngine;
using UnityEngine.UI;

public class StreamingUI : MonoBehaviour
{
    public Button streamButton;
    private RenderStreamControl streamControl;
    
    void Start()
    {
        streamControl = FindObjectOfType<RenderStreamControl>();
        
        if (streamButton != null)
        {
            streamButton.onClick.AddListener(ToggleStreaming);
        }
    }
    
    void ToggleStreaming()
    {
        streamControl.toggleStreamFunc();
        
        // Update button text
        if (streamControl.IsCurrentlyStreaming())
        {
            streamButton.GetComponentInChildren<Text>().text = "Stop Streaming";
        }
        else
        {
            streamButton.GetComponentInChildren<Text>().text = "Start Streaming";
        }
    }
}
```

---

## 🔧 Configuration Options

### Performance Optimization

**Large Scene Optimization:**

The SDK is optimized for large scenes with tens of thousands of GameObjects:
- ✅ Efficient component searching using Type.GetType()
- ✅ No expensive FindObjectsOfType<MonoBehaviour>() calls
- ✅ Minimal allocation overhead
- ✅ Safe for production games with complex scenes

**Note:** The SDK automatically disables conflicting Unity Render Streaming components without scanning all MonoBehaviours in your scene.

### Quality Settings (Adjust in Inspector)

**High Quality (default):**
- Stream Bitrate: 8000 (8 Mbps)
- Stream Frame Rate: 60 fps
- **Best for:** Good internet, desktop viewers
- **File size:** ~4 GB/hour
- **Unity 6+:** Full quality control available
- **Unity 2022.3.x:** Uses compatible settings

**Medium Quality:**
- Stream Bitrate: 5000 (5 Mbps)
- Stream Frame Rate: 30 fps
- **Best for:** Mobile viewers, slower internet
- **File size:** ~2 GB/hour

**Low Quality:**
- Stream Bitrate: 3000 (3 Mbps)
- Stream Frame Rate: 30 fps
- **Best for:** Very slow internet
- **File size:** ~1.3 GB/hour

**Unity Version Notes:**
- Unity 6+: All quality settings fully configurable
- Unity 2022.3.x: Quality settings applied via compatible methods
- The SDK automatically detects your Unity version and uses the best available APIs

---

## ✅ Integration Checklist

**Before submitting your game:**

- [ ] `RenderStreamControl.cs` added to project
- [ ] Component attached to scene object
- [ ] Backend URL configured: `https://your-backend.up.railway.app`
- [ ] Stream-Settings.asset created and configured
- [ ] Tested in Unity Editor (press `L` key)
- [ ] Stream appears in browser at `/receiver/` page
- [ ] Built for Quest
- [ ] Tested on Quest headset
- [ ] Quality is acceptable (smooth, clear)
- [ ] No errors in Unity console

---

## 🐛 Troubleshooting

### "Can't connect to backend"

**Check:**
- Backend URL is correct in Inspector
- URL starts with `https://` for production (or `wss://` in Stream-Settings)
- No typos in URL
- Internet connection working

**Test backend:**
```
https://your-backend.up.railway.app/health
```
Should return JSON with `"status": "ok"`

---

### "No video in browser"

**Check:**
- Opened `/receiver/` page (not just `/`)
- Clicked "Play" button in browser
- Unity console shows "WebRTC Connection STARTED"
- Both browser and game have internet access

---

### "Stream quality is poor"

**Try:**
- Increase Stream Bitrate in Inspector (try 10000 for 10 Mbps)
- Check internet speed (need at least 10 Mbps upload)
- Use wired connection instead of WiFi if possible

---

### "Works in Editor but not on Quest"

**Check:**
- Build settings have IL2CPP enabled
- ARM64 architecture selected
- Quest has internet connection
- WebSocket URL uses `wss://` (secure) not `ws://`

---

## 📞 Need Help?

**Contact:** [Your support email/channel]

**Provide:**
1. Unity console logs
2. What step you're stuck on
3. Whether it works in Editor
4. Quest headset model

**Common fixes usually take 2-3 minutes!**

---

## 🎬 That's It!

**Integration time:** ~20 minutes  
**Your players get:** Live streaming to web browsers  
**Parents get:** Real-time viewing + recordings  

**Backend URL we'll provide:**
```
https://your-backend.up.railway.app
```

**Test viewer page:**
```
https://your-backend.up.railway.app/receiver/
```

**Ready to integrate!** 🚀

