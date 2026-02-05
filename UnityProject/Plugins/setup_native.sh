#!/bin/bash
#
# One-click setup for native FFmpeg streaming library
# Run this script, then restart Unity
#

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       Native FFmpeg Library Setup for Unity                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macOS"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="Windows"
else
    echo "❌ Unsupported platform: $OSTYPE"
    echo "   This script supports macOS and Windows."
    exit 1
fi

echo "Detected platform: $PLATFORM"
echo ""

if [[ "$PLATFORM" == "macOS" ]]; then
    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found."
        echo "   Install it from: https://brew.sh"
        echo "   Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    echo "✅ Homebrew found"

    # Install FFmpeg if not present
    if ! command -v ffmpeg &> /dev/null; then
        echo "📦 Installing FFmpeg via Homebrew..."
        brew install ffmpeg
    else
        echo "✅ FFmpeg already installed: $(which ffmpeg)"
    fi

    # Build native library
    echo ""
    echo "🔨 Building native library..."
    cd "$(dirname "$0")/Native"
    ./build.sh macos

    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  ✅ Setup complete!                                            ║"
    echo "║                                                                ║"
    echo "║  Next steps:                                                   ║"
    echo "║  1. Quit Unity completely                                      ║"
    echo "║  2. Reopen your Unity project                                  ║"
    echo "║  3. The native library will be loaded automatically            ║"
    echo "╚════════════════════════════════════════════════════════════════╝"

elif [[ "$PLATFORM" == "Windows" ]]; then
    echo "❌ Windows automated setup not yet available."
    echo ""
    echo "Manual steps for Windows:"
    echo "1. Download FFmpeg: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z"
    echo "2. Extract and add to PATH"
    echo "3. Run: cd Native && cmake . && cmake --build . --config Release"
    echo "4. Copy build/Release/ffmpeg_rtmp.dll to Plugins/x86_64/"
    exit 1
fi
