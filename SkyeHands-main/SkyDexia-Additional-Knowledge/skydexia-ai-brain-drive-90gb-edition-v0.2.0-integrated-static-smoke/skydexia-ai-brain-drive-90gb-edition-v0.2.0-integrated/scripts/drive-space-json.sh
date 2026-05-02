#!/usr/bin/env bash
set -Eeuo pipefail
TARGET="${SKYDEXIA_DRIVE:-.}"
LINE="$(df -k "$TARGET" | awk 'NR==2 {print $1" "$2" "$3" "$4" "$5" "$6}')"
read -r filesystem blocks used available usep mount <<< "$LINE"
available_gb=$(( available / 1024 / 1024 ))
used_gb=$(( used / 1024 / 1024 ))
total_gb=$(( blocks / 1024 / 1024 ))
status="ok"; message="Space is acceptable for 90GB Edition."
if [ "$available_gb" -lt 15 ]; then status="fail"; message="Less than 15GB free. Do not pull more models."; elif [ "$available_gb" -lt 30 ]; then status="warn"; message="Low free space. Stay Lite only."; fi
cat <<JSON
{"ok":true,"target":"$TARGET","filesystem":"$filesystem","mount":"$mount","total_gb":$total_gb,"used_gb":$used_gb,"available_gb":$available_gb,"use_percent":"$usep","status":"$status","message":"$message","required_free_space_gb":15}
JSON
