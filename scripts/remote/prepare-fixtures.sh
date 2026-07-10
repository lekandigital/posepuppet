#!/usr/bin/env bash
# PosePuppet Remote Fixture Preparation — validates fixtures and generates Y4M.
# Never modifies original fixture files.
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

CACHE_DIR=".local/cache/fake-camera"

echo "==> PosePuppet Remote Fixture Preparation"

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ERROR: ffprobe not found. Install ffmpeg."
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg not found."
  exit 1
fi

if [ ! -d "fixtures" ]; then
  echo "No fixtures directory found. Nothing to prepare."
  exit 0
fi

mkdir -p "$CACHE_DIR"

FAIL=0
echo ""
echo "Validating fixtures..."
echo ""

find fixtures -type f \( -name "*.mp4" -o -name "*.mov" \) | sort | while read -r file; do
  echo "--- $(basename "$file") ---"

  # Run ffprobe and extract metadata
  PROBE=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,avg_frame_rate,r_frame_rate,codec_name,duration \
    -show_entries format=size,duration,nb_streams \
    -of json "$file" 2>/dev/null)

  if [ -z "$PROBE" ] || [ "$PROBE" = "null" ]; then
    echo "  ✗ CORRUPT or UNREADABLE"
    continue
  fi

  # Extract fields
  WIDTH=$(echo "$PROBE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['streams'][0].get('width','?'))" 2>/dev/null || echo "?")
  HEIGHT=$(echo "$PROBE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['streams'][0].get('height','?'))" 2>/dev/null || echo "?")
  CODEC=$(echo "$PROBE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['streams'][0].get('codec_name','?'))" 2>/dev/null || echo "?")
  AVG_FPS=$(echo "$PROBE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['streams'][0].get('avg_frame_rate','?'))" 2>/dev/null || echo "?")
  R_FPS=$(echo "$PROBE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['streams'][0].get('r_frame_rate','?'))" 2>/dev/null || echo "?")
  DURATION=$(echo "$PROBE" | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('format',{}).get('duration',d['streams'][0].get('duration','?')); print(s)" 2>/dev/null || echo "?")
  SIZE=$(du -h "$file" | cut -f1)

  # Check for audio streams
  AUDIO=$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$file" 2>/dev/null)
  HAS_AUDIO="no"
  [ -n "$AUDIO" ] && HAS_AUDIO="yes ($AUDIO)"

  echo "  Size: $SIZE"
  echo "  Duration: ${DURATION}s"
  echo "  Dimensions: ${WIDTH}x${HEIGHT}"
  echo "  Codec: $CODEC"
  echo "  Avg FPS: $AVG_FPS"
  echo "  Real FPS: $R_FPS"
  echo "  Audio: $HAS_AUDIO"
  echo "  ✓ Valid"

  # Generate Y4M if not already cached
  BASENAME=$(basename "$file")
  NAME="${BASENAME%.*}"
  Y4M_OUT="$CACHE_DIR/${NAME}.y4m"

  if [ -f "$Y4M_OUT" ]; then
    Y4M_SIZE=$(du -h "$Y4M_OUT" | cut -f1)
    echo "  Y4M: exists ($Y4M_SIZE)"
  else
    echo "  Y4M: converting..."
    if ffmpeg -y -i "$file" -pix_fmt yuv420p "$Y4M_OUT" -loglevel error 2>&1; then
      Y4M_SIZE=$(du -h "$Y4M_OUT" | cut -f1)
      echo "  Y4M: created ($Y4M_SIZE)"
    else
      echo "  Y4M: CONVERSION FAILED"
    fi
  fi
  echo ""
done

echo "Fixture preparation complete."
echo ""
echo "Cache directory: $CACHE_DIR"
ls -lh "$CACHE_DIR"/*.y4m 2>/dev/null || echo "No Y4M files generated."
