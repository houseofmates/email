#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== building email frontend ==="
cd "$PROJECT_DIR/frontend"
npm install --silent 2>/dev/null
npx vite build --outDir dist

echo "=== building extension ==="
cd "$PROJECT_DIR/extension"
npx --yes web-ext build --overwrite-dest 2>/dev/null

echo "=== building android apk (email) ==="
cd "$PROJECT_DIR/mobile"
npm install --silent 2>/dev/null
ANDROID_HOME="$ANDROID_HOME" npx cap sync android 2>/dev/null
cd android
ANDROID_HOME="$ANDROID_HOME" ./gradlew assembleDebug 2>/dev/null

echo "=== building android apk (passwords) ==="
cd "$PROJECT_DIR/mobile-passwords"
npm install --silent 2>/dev/null
ANDROID_HOME="$ANDROID_HOME" npx cap sync android 2>/dev/null
cd android
ANDROID_HOME="$ANDROID_HOME" ./gradlew assembleDebug 2>/dev/null

echo ""
echo "=== build complete ==="
echo "frontend:   $PROJECT_DIR/frontend/dist/"
echo "extension:  $(ls -t $PROJECT_DIR/extension/web-ext-artifacts/*.zip | head -1)"
echo "apk email:  $PROJECT_DIR/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
echo "apk pwords: $PROJECT_DIR/mobile-passwords/android/app/build/outputs/apk/debug/app-debug.apk"