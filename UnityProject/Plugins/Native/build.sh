#!/bin/bash
#
# Build script for FFmpeg RTMP Unity Plugin
# Builds for macOS (development), Windows, Android, and iOS
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
OUTPUT_DIR="${SCRIPT_DIR}/../"

echo "=== FFmpeg RTMP Unity Plugin Build Script ==="
echo "Script directory: ${SCRIPT_DIR}"
echo "Output directory: ${OUTPUT_DIR}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check for FFmpeg
check_ffmpeg() {
    if command -v ffmpeg &> /dev/null; then
        info "FFmpeg found: $(which ffmpeg)"
        return 0
    fi
    return 1
}

# Install FFmpeg for macOS
install_ffmpeg_macos() {
    info "Installing FFmpeg via Homebrew..."
    if ! command -v brew &> /dev/null; then
        error "Homebrew not found. Please install Homebrew first."
    fi
    brew install ffmpeg
}

# Build for macOS (local development)
build_macos() {
    info "Building for macOS..."
    
    mkdir -p "${BUILD_DIR}/macos"
    cd "${BUILD_DIR}/macos"
    
    cmake "${SCRIPT_DIR}" \
        -DCMAKE_BUILD_TYPE=Release \
        -DFFMPEG_ROOT=/opt/homebrew
    
    cmake --build . --config Release
    
    # Copy to Unity plugins folder
    mkdir -p "${OUTPUT_DIR}/macOS"
    cp out/libffmpeg_rtmp.dylib "${OUTPUT_DIR}/macOS/"
    
    info "macOS build complete: ${OUTPUT_DIR}/macOS/libffmpeg_rtmp.dylib"
}

# Build for Windows (cross-compile or native)
build_windows() {
    info "Building for Windows..."
    
    # Check if we're on Windows or need to cross-compile
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Native Windows build
        mkdir -p "${BUILD_DIR}/windows"
        cd "${BUILD_DIR}/windows"
        
        cmake "${SCRIPT_DIR}" \
            -G "Visual Studio 17 2022" \
            -A x64 \
            -DCMAKE_BUILD_TYPE=Release
        
        cmake --build . --config Release
        
        mkdir -p "${OUTPUT_DIR}/x86_64"
        cp out/Release/ffmpeg_rtmp.dll "${OUTPUT_DIR}/x86_64/"
    else
        warn "Windows cross-compilation not supported from this platform."
        warn "Please build on Windows or use pre-built binaries."
        return 1
    fi
    
    info "Windows build complete"
}

# Build for Android (requires NDK)
build_android() {
    info "Building for Android..."
    
    if [[ -z "${ANDROID_NDK_HOME}" ]]; then
        # Try to find NDK
        if [[ -d "$HOME/Library/Android/sdk/ndk" ]]; then
            export ANDROID_NDK_HOME=$(ls -d "$HOME/Library/Android/sdk/ndk"/* | tail -1)
        elif [[ -d "$HOME/Android/Sdk/ndk" ]]; then
            export ANDROID_NDK_HOME=$(ls -d "$HOME/Android/Sdk/ndk"/* | tail -1)
        else
            error "Android NDK not found. Set ANDROID_NDK_HOME environment variable."
        fi
    fi
    
    info "Using Android NDK: ${ANDROID_NDK_HOME}"
    
    # Build for arm64-v8a (Quest)
    mkdir -p "${BUILD_DIR}/android-arm64"
    cd "${BUILD_DIR}/android-arm64"
    
    # Note: This requires FFmpeg built for Android
    # Using FFmpegKit pre-built binaries is recommended
    warn "Android build requires pre-built FFmpeg for Android."
    warn "Download FFmpegKit from: https://github.com/arthenica/ffmpeg-kit/releases"
    warn "Place in: ${SCRIPT_DIR}/ffmpeg-android/"
    
    if [[ -d "${SCRIPT_DIR}/ffmpeg-android" ]]; then
        cmake "${SCRIPT_DIR}" \
            -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK_HOME}/build/cmake/android.toolchain.cmake" \
            -DANDROID_ABI=arm64-v8a \
            -DANDROID_PLATFORM=android-24 \
            -DCMAKE_BUILD_TYPE=Release \
            -DFFMPEG_ROOT="${SCRIPT_DIR}/ffmpeg-android"
        
        cmake --build . --config Release
        
        mkdir -p "${OUTPUT_DIR}/Android/libs/arm64-v8a"
        cp out/libffmpeg_rtmp.so "${OUTPUT_DIR}/Android/libs/arm64-v8a/"
        
        info "Android build complete: ${OUTPUT_DIR}/Android/libs/arm64-v8a/libffmpeg_rtmp.so"
    else
        warn "Skipping Android build - FFmpeg Android binaries not found"
    fi
}

# Build for iOS
build_ios() {
    info "Building for iOS..."
    
    if [[ "$OSTYPE" != "darwin"* ]]; then
        warn "iOS builds require macOS"
        return 1
    fi
    
    mkdir -p "${BUILD_DIR}/ios"
    cd "${BUILD_DIR}/ios"
    
    warn "iOS build requires pre-built FFmpeg for iOS."
    warn "Download FFmpegKit from: https://github.com/arthenica/ffmpeg-kit/releases"
    warn "Place in: ${SCRIPT_DIR}/ffmpeg-ios/"
    
    if [[ -d "${SCRIPT_DIR}/ffmpeg-ios" ]]; then
        cmake "${SCRIPT_DIR}" \
            -G Xcode \
            -DCMAKE_SYSTEM_NAME=iOS \
            -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
            -DCMAKE_OSX_ARCHITECTURES=arm64 \
            -DFFMPEG_ROOT="${SCRIPT_DIR}/ffmpeg-ios"
        
        cmake --build . --config Release -- -sdk iphoneos
        
        mkdir -p "${OUTPUT_DIR}/iOS"
        cp -r out/Release/libffmpeg_rtmp.a "${OUTPUT_DIR}/iOS/"
        
        info "iOS build complete: ${OUTPUT_DIR}/iOS/libffmpeg_rtmp.a"
    else
        warn "Skipping iOS build - FFmpeg iOS binaries not found"
    fi
}

# Download FFmpegKit pre-built binaries
download_ffmpegkit() {
    info "Downloading FFmpegKit pre-built binaries..."
    
    FFMPEGKIT_VERSION="6.0"
    FFMPEGKIT_BASE="https://github.com/arthenica/ffmpeg-kit/releases/download/v${FFMPEGKIT_VERSION}"
    
    mkdir -p "${SCRIPT_DIR}/deps"
    cd "${SCRIPT_DIR}/deps"
    
    # Android
    if [[ ! -d "${SCRIPT_DIR}/ffmpeg-android" ]]; then
        info "Downloading FFmpegKit for Android..."
        curl -L -o ffmpegkit-android.zip "${FFMPEGKIT_BASE}/ffmpegkit-full-${FFMPEGKIT_VERSION}-android-main.zip" || warn "Android download failed"
        if [[ -f ffmpegkit-android.zip ]]; then
            unzip -q ffmpegkit-android.zip -d ffmpegkit-android
            mv ffmpegkit-android/*/arm64-v8a "${SCRIPT_DIR}/ffmpeg-android" 2>/dev/null || true
        fi
    fi
    
    # iOS
    if [[ ! -d "${SCRIPT_DIR}/ffmpeg-ios" ]]; then
        info "Downloading FFmpegKit for iOS..."
        curl -L -o ffmpegkit-ios.zip "${FFMPEGKIT_BASE}/ffmpegkit-full-${FFMPEGKIT_VERSION}-ios-xcframework.zip" || warn "iOS download failed"
        if [[ -f ffmpegkit-ios.zip ]]; then
            unzip -q ffmpegkit-ios.zip -d ffmpegkit-ios
            mkdir -p "${SCRIPT_DIR}/ffmpeg-ios"
            # Extract from xcframework
        fi
    fi
    
    info "FFmpegKit download complete"
}

# Clean build artifacts
clean() {
    info "Cleaning build artifacts..."
    rm -rf "${BUILD_DIR}"
    info "Clean complete"
}

# Main
main() {
    case "${1:-all}" in
        macos)
            if ! check_ffmpeg; then
                install_ffmpeg_macos
            fi
            build_macos
            ;;
        windows)
            build_windows
            ;;
        android)
            build_android
            ;;
        ios)
            build_ios
            ;;
        download)
            download_ffmpegkit
            ;;
        clean)
            clean
            ;;
        all)
            if ! check_ffmpeg; then
                install_ffmpeg_macos
            fi
            build_macos
            build_android
            build_ios
            ;;
        *)
            echo "Usage: $0 {macos|windows|android|ios|download|clean|all}"
            echo ""
            echo "Commands:"
            echo "  macos    - Build for macOS (local development)"
            echo "  windows  - Build for Windows x64"
            echo "  android  - Build for Android arm64 (Quest)"
            echo "  ios      - Build for iOS arm64"
            echo "  download - Download FFmpegKit pre-built binaries"
            echo "  clean    - Remove build artifacts"
            echo "  all      - Build for all platforms"
            exit 1
            ;;
    esac
}

main "$@"

