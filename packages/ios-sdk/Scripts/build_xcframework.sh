#!/usr/bin/env bash
# build_xcframework.sh
#
# Produces a fat `SubstreamSDK.xcframework` containing iOS-device (arm64),
# iOS-simulator (arm64 + x86_64) slices. Attached to GitHub releases by
# .github/workflows/ios.yml so developers without a package manager can
# drag-and-drop the framework into their project.
#
# Requires: Xcode 15.4+, xcodebuild, zip, shasum.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "$HERE/.." && pwd)"
BUILD_DIR="$PKG_ROOT/build"
SCHEME="SubstreamSDK"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cd "$PKG_ROOT"

echo "==> Building iOS device archive"
xcodebuild archive \
    -scheme "$SCHEME" \
    -destination "generic/platform=iOS" \
    -archivePath "$BUILD_DIR/ios-device.xcarchive" \
    -skipPackagePluginValidation \
    SKIP_INSTALL=NO \
    BUILD_LIBRARY_FOR_DISTRIBUTION=YES | xcpretty || true

echo "==> Building iOS simulator archive"
xcodebuild archive \
    -scheme "$SCHEME" \
    -destination "generic/platform=iOS Simulator" \
    -archivePath "$BUILD_DIR/ios-sim.xcarchive" \
    -skipPackagePluginValidation \
    SKIP_INSTALL=NO \
    BUILD_LIBRARY_FOR_DISTRIBUTION=YES | xcpretty || true

echo "==> Packaging xcframework"
xcodebuild -create-xcframework \
    -framework "$BUILD_DIR/ios-device.xcarchive/Products/Library/Frameworks/SubstreamSDK.framework" \
    -framework "$BUILD_DIR/ios-sim.xcarchive/Products/Library/Frameworks/SubstreamSDK.framework" \
    -output "$BUILD_DIR/SubstreamSDK.xcframework"

echo "==> Compressing"
cd "$BUILD_DIR"
zip -rq SubstreamSDK.xcframework.zip SubstreamSDK.xcframework
shasum -a 256 SubstreamSDK.xcframework.zip > SubstreamSDK.xcframework.zip.sha256

echo "==> Done. Artifacts:"
ls -lh "$BUILD_DIR/SubstreamSDK.xcframework.zip"
cat "$BUILD_DIR/SubstreamSDK.xcframework.zip.sha256"
