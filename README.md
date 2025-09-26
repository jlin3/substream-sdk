# Substream Unity SDK - Render Streaming Example

This project demonstrates using the Substream SDK with Unity Render Streaming to stream your Unity scenes to a web backend.

## Prerequisites

- Unity 2023+
- Unity Render Streaming package v3.1.0-exp7
- Access to a server (we used [Railway](https://railway.app/))

## Setup

1. Import the Unity package  
   Import `substream-sdk.unitypackage` into your project.

2. Install Render Streaming  
   Install Unity Render Streaming (v3.1.0-exp7).

3. Fix project settings  
   Open the Render Streaming Wizard (`Window > Render Streaming > Wizard`) and click **Fix All** if prompted.

4. Set up the web backend  
   Upload the `WebappBackend` folder to your server. If using Railway, push it as a repo and copy the generated URL.

5. Connect Unity to your backend  
   In Unity, open `Project Settings > Render Streaming` and enter your backend URL.

6. Open the test scene  
   Open the `Stream-test` scene in Unity.

7. Start streaming  
   Hit **Play**, then click the **STREAM** button to begin streaming to your URL.
