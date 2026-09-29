#!/usr/bin/env bash
# One-off: download the pre-generated portraits, voices and talking clips and compress them into media/.
# Usage: bash fetch-media.sh manifest.txt   (lines: "<name> <url>")
set -euo pipefail
cd "$(dirname "$0")"
FF="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || command -v ffmpeg)}"
mkdir -p media/a media/raw
while read -r name url; do
  [ -z "$name" ] && continue
  raw="media/raw/$name"
  [ -s "$raw" ] || curl -sSfL --retry 3 -o "$raw" "$url"
  case "$name" in
    p_*.png) # video callers are 4:3 frames, chat avatars square
      "$FF" -loglevel error -y -i "$raw" -vf "scale='min(960,iw)':-2" -q:v 4 "media/${name%.png}.jpg" ;;
    v_*.mp4)
      "$FF" -loglevel error -y -i "$raw" -an -vf "scale=640:-2" -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart "media/$name" ;;
    *.wav)
      "$FF" -loglevel error -y -i "$raw" -ac 1 -ar 24000 -c:a libmp3lame -b:a 48k "media/a/${name%.wav}.mp3" ;;
  esac
  echo "ok $name"
done < "${1:-manifest.txt}"
rm -rf media/raw
du -sh media
