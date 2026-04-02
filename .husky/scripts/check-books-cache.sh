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

isbn10_to_isbn13() {
  local nine="978${1:0:9}"
  local sum=0
  for i in {0..11}; do
    local d="${nine:$i:1}"
    if (( i % 2 == 0 )); then (( sum += d )); else (( sum += d * 3 )); fi
  done
  echo "${nine}$(( (10 - (sum % 10)) % 10 ))"
}

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  # Strip hyphens, drop pipe-override suffix, skip asin: lines, extract 10- or 13-digit runs
  while IFS= read -r RAW; do
    [ -z "$RAW" ] && continue
    LEN=${#RAW}
    if [ "$LEN" -eq 13 ] && [[ "$RAW" =~ ^(978|979) ]]; then
      ISBN13="$RAW"
    elif [ "$LEN" -eq 10 ]; then
      ISBN13=$(isbn10_to_isbn13 "$RAW")
    else
      continue
    fi
    if ! grep -q "\"$ISBN13\"" "$CACHE"; then
      MISSING+=("$ISBN13  ($FILE)")
    fi
  done < <(grep -i 'isbn' "$FILE" | sed 's/|.*//' | tr -d '"-: ' | grep -oE '[0-9]{10,13}')
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
