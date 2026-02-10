#!/bin/bash
set -e

# PracticePal Release Script
# Usage:
#   ./release.sh patch    # 1.0.0 → 1.0.1  (bug fixes)
#   ./release.sh minor    # 1.0.0 → 1.1.0  (new features)
#   ./release.sh major    # 1.0.0 → 2.0.0  (breaking changes)

BUMP_TYPE=${1:-patch}
MANIFEST="manifest.json"

# ─── Validate ────────────────────────────────────────────────
if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ manifest.json not found. Run this from the project root."
  exit 1
fi

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "❌ Invalid bump type: $BUMP_TYPE"
  echo "   Usage: ./release.sh [patch|minor|major]"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ You have uncommitted changes. Commit or stash them first."
  exit 1
fi

# ─── Read current version ───────────────────────────────────
CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$MANIFEST" | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

echo "📦 Current version: $CURRENT_VERSION"

# ─── Bump version ───────────────────────────────────────────
case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "🚀 New version: $NEW_VERSION"

# ─── Update manifest.json ───────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
else
  sed -i "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
fi

echo "✅ Updated manifest.json"

# ─── Collect changes for release notes ───────────────────────
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LAST_TAG" ]]; then
  CHANGES=$(git log "$LAST_TAG"..HEAD --pretty=format:"- %s" --no-merges)
else
  CHANGES=$(git log --pretty=format:"- %s" --no-merges)
fi

# ─── Build release zip ──────────────────────────────────────
ZIP_NAME="practicepal-v${NEW_VERSION}.zip"
DIST_DIR="dist"
mkdir -p "$DIST_DIR"

# Remove old zips in dist
rm -f "$DIST_DIR"/practicepal-*.zip

# Create clean zip (only files needed for Chrome Web Store)
zip -r "$DIST_DIR/$ZIP_NAME" \
  manifest.json \
  src/ \
  -x "*.DS_Store" \
  -x "*__MACOSX*" \
  -x "*.git*" \
  -x "src/audio/tf-chord-processor.js" \
  -x "src/lib/*"

echo "✅ Created $DIST_DIR/$ZIP_NAME"

# ─── Commit, tag, and push ──────────────────────────────────
git add manifest.json
git commit -m "release: v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

$CHANGES"

echo ""
echo "✅ Tagged v$NEW_VERSION"
echo ""
echo "📋 Release notes:"
echo "$CHANGES"
echo ""

# Push commit and tag
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Pushed to GitHub"
echo "📦 Upload $DIST_DIR/$ZIP_NAME to Chrome Web Store"
echo "🔗 GitHub will automatically create a release with the zip attached"
