#!/usr/bin/env bash
set -euo pipefail
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"

echo "==> Remote Fixture Preparation"
mkdir -p .local/cache/fake-camera/

if [ ! -d "fixtures" ]; then
  echo "No fixtures directory found."
  exit 0
fi

find fixtures -type f \( -name "*.mp4" -o -name "*.mov" \) | while read -r file; do
  echo "Validating $file..."
  if ! ffprobe -v error -show_format -show_streams "$file" > /dev/null; then
    echo "Warning: $file is invalid or corrupt."
    continue
  fi
  
  filename=$(basename -- "$file")
  name="${filename%.*}"
  y4m_out=".local/cache/fake-camera/$name.y4m"
  
  if [ ! -f "$y4m_out" ]; then
    echo "Converting $file to Y4M for fake-camera test..."
    ffmpeg -y -i "$file" -pix_fmt yuv420p "$y4m_out" -loglevel error
  else
    echo "Y4M format already exists: $y4m_out"
  fi
done

echo "Fixture preparation complete."
