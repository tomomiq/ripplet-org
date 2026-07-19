#!/bin/bash
# If any staged weeknotes contain a local cover override (pipe syntax with a
# filename, not an ASIN), upload the cover to Vercel Blob, update the cache,
# strip the pipe from frontmatter, and delete the local file — all before the
# cache check runs.

STAGED=$(git diff --cached --name-only | grep '^src/content/weeknotes/.*\.md$' || true)
[ -z "$STAGED" ] && exit 0

# Check for pipe+local-file in any staged weeknote isbn field
HAS_PIPE=false
while IFS= read -r FILE; do
  if grep -i 'isbn' "$FILE" | grep -q '|'; then
    HAS_PIPE=true
    break
  fi
done <<< "$STAGED"

$HAS_PIPE || exit 0

echo "[books] Local cover override detected — uploading to Blob..."

if [ ! -f ".env.local" ]; then
  echo "[books] .env.local not found. Run: vercel env pull .env.local"
  exit 1
fi

node --env-file=.env.local scripts/sync-book-covers.mjs || exit 1

# Re-stage files modified by the sync script
git add -u src/content/weeknotes/ src/lib/books-cache.json
git add -u public/weeknotes-images/

echo "[books] Cover sync complete."
