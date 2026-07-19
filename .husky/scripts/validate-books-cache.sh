#!/bin/bash
# Validate books-cache.json before commit.

CACHE="src/lib/books-cache.json"

[ ! -f "$CACHE" ] && exit 0

# Only run if the cache is staged (or FORCE_VALIDATE=1 for manual runs)
git diff --cached --name-only | grep -q "^$CACHE$" || [ "${FORCE_VALIDATE:-0}" = "1" ] || exit 0

# 1. Validate JSON syntax
if ! python3 -c "import json; json.load(open('$CACHE'))" 2>/dev/null; then
  echo ""
  echo "Commit blocked: books-cache.json contains invalid JSON."
  echo "Check for missing commas, trailing commas, or malformed entries."
  python3 -c "import json; json.load(open('$CACHE'))" 2>&1 | sed 's/^/  /'
  echo ""
  exit 1
fi

# 2. Check for incorrect field casing
ISSUES=$(grep -n '"coverURL"\|"publisherURL"\|"infoURL"' "$CACHE" || true)
if [ -n "$ISSUES" ]; then
  echo ""
  echo "Commit blocked: books-cache.json has incorrect field names (use lowercase Url, not URL):"
  echo "$ISSUES" | sed 's/^/  /'
  echo ""
  exit 1
fi

# 3. Warn about notFound entries
NOT_FOUND=$(python3 -c "
import json
data = json.load(open('$CACHE'))
for isbn, entry in data.items():
    if entry.get('notFound'):
        print(isbn)
" 2>/dev/null)

if [ -n "$NOT_FOUND" ]; then
  echo ""
  echo "[books] Warning: these ISBNs are marked notFound — check for typos:"
  while IFS= read -r ISBN; do
    MATCH=$(grep -rl "${ISBN:3}" src/content/weeknotes/ 2>/dev/null | head -1 | sed 's|src/content/weeknotes/||')
    if [ -n "$MATCH" ]; then
      echo "  $ISBN  ($MATCH)"
    else
      echo "  $ISBN"
    fi
  done <<< "$NOT_FOUND"
  echo "  To retry: delete the entry from the cache and reload in vercel dev."
  echo ""
fi

echo "[books] books-cache.json is valid."
