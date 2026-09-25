#!/usr/bin/env bash
# Removes optional camera assistance from Memoria 3D — everything apply.sh added, nothing else.
#
#   integrations/memoria-3d/unapply.sh "/path/to/3D game"
#
# Reverse-applies the patch, restores package.json / package-lock.json from git (apply.sh's
# npm step is their only change), and deletes the added paths. Other local changes survive.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
game="${1:-}"
[[ -n "$game" && -d "$game" ]] || { echo "usage: $0 <path to the Memoria game repo>" >&2; exit 2; }
game="$(cd "$game" && pwd)"

if git -C "$game" apply --reverse --check "$here/memoria-3d.patch" >/dev/null 2>&1; then
  git -C "$game" apply --reverse "$here/memoria-3d.patch"
  echo "reversed: memoria-3d.patch"
else
  echo "patch not applied (or edited since); restoring its files from git instead"
  git -C "$game" checkout -- .gitignore vite.config.ts src/Missions.ts src/main.ts src/ui.ts
fi
git -C "$game" checkout -- package.json package-lock.json
rm -rf "$game/src/observation" "$game/public/mediapipe" "$game/public/models/face_landmarker.task"
rmdir "$game/public/models" 2>/dev/null || true
echo "removed: src/observation/, public/mediapipe/, public/models/face_landmarker.task"
echo "node_modules/@mediapipe/tasks-vision is left installed; 'npm install' (or npm prune) drops it."
