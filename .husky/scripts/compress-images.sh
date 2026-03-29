#!/bin/bash
# Compress/convert newly staged images in public/weeknotes-images/
# - HEIC: always convert to JPEG
# - JPG/PNG: only compress if wider than 1800px
# Requires: ImageMagick 7

IMAGES_DIR="public/weeknotes-images"
MAX_PX=1800
QUALITY=82

staged_images=$(git diff --cached --name-only --diff-filter=A | grep -iE "^${IMAGES_DIR}/.*\.(jpg|jpeg|png|heic)$")

if [ -z "$staged_images" ]; then
  exit 0
fi

echo "Compressing images before commit..."

for img in $staged_images; do
  if [[ "$img" =~ \.[Hh][Ee][Ii][Cc]$ ]]; then
    out="${img%.*}.jpg"
    echo "  → $img (converting HEIC → JPEG)"
    magick "$img" -auto-orient -resize "${MAX_PX}x${MAX_PX}>" -quality $QUALITY -strip "$out"
    git add "$out"
    git rm --cached "$img"
    rm "$img"
  else
    width=$(magick identify -format "%w" "$img" 2>/dev/null | head -1)
    if [ -n "$width" ] && [ "$width" -gt $MAX_PX ]; then
      echo "  → $img (${width}px — resizing)"
      magick "$img" -auto-orient -resize "${MAX_PX}x${MAX_PX}>" -quality $QUALITY -strip "$img"
      git add "$img"
    else
      echo "  → $img (${width}px — already web-sized, skipping)"
    fi
  fi
done

echo "Done."
