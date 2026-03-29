#!/bin/bash
# Abort commit if staged weeknotes contain ISBNs not yet in books-cache.json.
# Fix: run 'npm run build' to fetch and cache book data, then re-commit.

CACHE="src/lib/books-cache.json"
MISSING=()

STAGED=$(git diff --cached --name-only | grep '^src/content/weeknotes/.*\.md$' || true)

[ -z "$STAGED" ] && exit 0

if [ ! -f "$CACHE" ]; then
  echo "[books] books-cache.json not found — run: npm run build"
  exit 1
fi

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  ISBNS=$(grep -oE '[0-9]{13}' "$FILE" | grep -E '^(978|979)' || true)
  for ISBN in $ISBNS; do
    if ! grep -q "\"$ISBN\"" "$CACHE"; then
      MISSING+=("$ISBN  ($FILE)")
    fi
  done
done <<< "$STAGED"

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "Commit blocked: the following ISBNs are not in books-cache.json."
  echo "Run 'npm run build' first, then commit."
  echo ""
  for M in "${MISSING[@]}"; do
    echo "  $M"
  done
  echo ""
  exit 1
fi
