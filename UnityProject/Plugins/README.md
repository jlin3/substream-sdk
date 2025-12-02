# FFmpeg RTMP Native Plugins

This folder contains native FFmpeg libraries for RTMP streaming across different platforms.

## Folder Structure

```
Plugins/
├── Native/              # Source code for building native library
│   ├── ffmpeg_rtmp_bridge.h
│   ├── ffmpeg_rtmp_bridge.c
│   ├── CMakeLists.txt
│   └── build.sh
├── macOS/               # macOS dylib (Editor + Standalone)
│   └── libffmpeg_rtmp.dylib
├── x86_64/              # Windows DLL (Editor + Standalone x64)
│   └── ffmpeg_rtmp.dll
├── Android/             # Android shared libraries
│   └── libs/
│       └── arm64-v8a/   # Quest VR (ARM64)
│           └── libffmpeg_rtmp.so
└── iOS/                 # iOS static library
    └── libffmpeg_rtmp.a
```

## Building for Each Platform

### macOS (Already Built)

```bash
cd Plugins/Native
./build.sh macos
```

Output: `Plugins/macOS/libffmpeg_rtmp.dylib`

### Windows

Requires:
- Visual Studio 2019+ with C++ tools
- vcpkg with FFmpeg: `vcpkg install ffmpeg:x64-windows`

```bash
cd Plugins/Native
./build.sh windows  # If using WSL
# Or use CMake directly on Windows
```

Alternatively, cross-compile from macOS using mingw-w64:
```bash
brew install mingw-w64
# Then modify CMakeLists.txt for cross-compilation
```

### Android (Quest VR)

Requires:
- Android NDK r21+ 
- FFmpeg built for Android ARM64

```bash
export ANDROID_NDK=/path/to/ndk
cd Plugins/Native
./build.sh android
```

For Quest VR specifically, use arm64-v8a architecture.

### iOS

Requires:
- Xcode with iOS SDK
- FFmpeg built for iOS (use FFmpegKit)

```bash
cd Plugins/Native
./build.sh ios
```

## Pre-built Binaries Alternative

Instead of building from source, you can use pre-built FFmpeg libraries:

### FFmpegKit (Recommended)
https://github.com/arthenica/ffmpeg-kit

- **Android**: Download `ffmpegkit-android-*.aar`
- **iOS**: Download `ffmpegkit-ios-*.xcframework`

### Gyan.dev Windows Builds
https://www.gyan.dev/ffmpeg/builds/

Download the "shared" build and extract DLLs.

## Unity Import Settings

Each platform's library needs proper import settings:

### macOS (.dylib)
- Platform: Editor + macOS
- CPU: Any CPU

### Windows (.dll)
- Platform: Editor + Windows x64
- CPU: x86_64

### Android (.so)
- Platform: Android only
- CPU: ARM64

### iOS (.a)
- Platform: iOS only
- Add to Xcode build via PostProcessBuild script

## Testing

### In Unity Editor (macOS)

1. Open Unity project
2. Check Console for: `[IVS] Native FFmpeg library available`
3. If you see `[IVS] Native FFmpeg library not available`, the library isn't loaded properly

### Troubleshooting

**Library not found:**
- Check file is in correct Plugins subfolder
- Check .meta file has correct platform settings
- Restart Unity after adding plugins

**DllNotFoundException:**
- On macOS: Check library is code-signed or allow in Security settings
- On Windows: Ensure all FFmpeg DLLs are present (avcodec, avformat, etc.)

**EntryPointNotFoundException:**
- Function names don't match between C# and native code
- Check for name mangling issues

## Required FFmpeg Libraries

The native bridge depends on these FFmpeg components:
- libavcodec (encoding)
- libavformat (muxing/RTMP)
- libavutil (utilities)
- libswscale (pixel format conversion)
- libswresample (audio resampling)

Make sure all are included when distributing.

