# Quick Debugging Guide - No Video in Browser

**Goal:** Get video streaming from Quest to browser

---

## 🔍 Step 1: Browser Check (30 seconds)

**Open in Chrome:** `https://your-backend.up.railway.app/receiver/`

1. Open browser DevTools: Press `F12`
2. Click **Console** tab
3. Click the **Play** button on the page
4. **Screenshot the Console** - send it to Jesse

**Look for:**
- ✅ "WebSocket connected"
- ✅ "Received offer from..."
- ❌ Any red errors?

---

## 🔍 Step 2: Chrome WebRTC Internals (1 minute)

**Most useful debug tool!**

1. Open new Chrome tab: `chrome://webrtc-internals`
2. Keep this tab open
3. In another tab, open `/receiver/` and click Play
4. Start streaming from Quest headset
5. Go back to `chrome://webrtc-internals`

**Screenshot and send:**
- The connection stats (shows if video track exists)
- ICE connection state (should say "connected" or "completed")

---

## 🔍 Step 3: Unity Headset Logs (1 minute)

**Connect Quest to computer via USB:**

```bash
adb logcat -s Unity | grep -i "stream\|webrtc\|video"
```

**Look for these messages:**
- ✅ "Stream camera setup complete: 1920x1080"
- ✅ "WebRTC Connection STARTED"
- ✅ "SignalingManager URL configured"
- ❌ Any errors?

**Screenshot the last 20 lines and send to Jesse**

---

## 🔍 Step 4: Railway Backend Logs (30 seconds)

1. Go to Railway dashboard
2. Click your deployment
3. Click **Deployments** → **View Logs**
4. Start streaming from Quest

**Look for:**
- WebSocket connection messages
- Offer/Answer exchanges
- **Screenshot any errors**

---

## 🎯 Quick Fixes to Try

### Fix #1: Same WiFi Network
- **Quest and Browser** both on same WiFi
- This bypasses TURN server issues
- Try this first!

### Fix #2: Use Chrome Desktop
- Not Safari, not Firefox, not mobile
- Chrome has best WebRTC support

### Fix #3: Verify URLs Match
**In Unity:**
- RenderStreamControl → Backend URL: `https://your-backend.up.railway.app`

**In Stream-Settings.asset:**
- WebSocket URL: `wss://your-backend.up.railway.app`

(Note: `https` → `wss`)

---

## 📸 What to Send Jesse

**Quick debug package - takes 2 minutes:**

1. **Browser Console screenshot** (F12 → Console, after clicking Play)
2. **chrome://webrtc-internals screenshot** (while streaming)
3. **Unity headset logs** (last 20 lines from adb logcat)
4. **Network info:**
   - Quest on WiFi network: `_______`
   - Browser on: Same WiFi / Different / LTE?

---

## 🔧 Common Issues & Solutions

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Sending/receiving messages" but no video | WebRTC video track not created | Check Unity logs for video setup errors |
| Browser shows "Waiting for stream..." | WebSocket not connected | Check backend URL matches in both places |
| Connection works in Editor, not on Quest | IL2CPP build issue | Check Build Settings → Scripting Backend: IL2CPP |
| Black screen in browser | Codec mismatch | Check chrome://webrtc-internals → codec info |

---

## ⚡ Fastest Path to Solution

**Do this in order (5 minutes total):**

1. ✅ Quest + Browser on same WiFi
2. ✅ Chrome desktop browser (not mobile)
3. ✅ Open `chrome://webrtc-internals` first
4. ✅ Then open `/receiver/` and click Play
5. ✅ Start streaming from Quest
6. ✅ Screenshot webrtc-internals
7. ✅ Send screenshot to Jesse

**This will immediately show:**
- Is video track being sent?
- Is connection established?
- What codec is being used?
- Where exactly it's failing?

---

## 🆘 Still Stuck?

**Send Jesse this info:**

```
Quest WiFi: [network name]
Browser: [Chrome/Safari/etc] on [Windows/Mac/Phone]
Backend URL: [your Railway URL]
Stream-Settings URL: [check in Unity]

Screenshots:
- [ ] Browser Console (F12)
- [ ] chrome://webrtc-internals
- [ ] Unity adb logcat output (last 20 lines)
```

**Jesse can then pinpoint the exact issue in ~30 seconds.**

