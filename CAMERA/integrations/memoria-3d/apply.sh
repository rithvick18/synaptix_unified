#!/usr/bin/env bash
# Adds optional camera assistance to Memoria 3D.
#
#   integrations/memoria-3d/apply.sh "/path/to/3D game" [--no-npm]
#
# 1. checks the game is a git repo with a clean tree (or already has this patch);
# 2. copies web/src/{protocol,transport,vision} (no tests) into <game>/src/observation/vendor/;
# 3. copies the MediaPipe WASM runtime and face model into <game>/public/ (git-ignored there);
# 4. git-applies memoria-3d.patch;
# 5. adds @mediapipe/tasks-vision (exact version from web/package.json) with npm.
#
# Idempotent: run it again to refresh the vendored code and assets; the patch is skipped
# when it is already applied. Revert with unapply.sh.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
camera="$(cd "$here/../.." && pwd)"
web="$camera/web"
patch="$here/memoria-3d.patch"

game="${1:-}"
npm_step=1
for arg in "${@:2}"; do
  case "$arg" in
    --no-npm) npm_step=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
if [[ -z "$game" || ! -d "$game" ]]; then
  echo "usage: $0 <path to the Memoria game repo> [--no-npm]" >&2
  exit 2
fi
game="$(cd "$game" && pwd)"
git -C "$game" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "$game is not a git repository" >&2; exit 1; }
[[ -f "$game/src/Missions.ts" && -f "$game/src/Telemetry.ts" ]] || { echo "$game does not look like Memoria 3D" >&2; exit 1; }

# --- Sources must exist ------------------------------------------------------------------
missing=0
for f in transport/contracts.ts transport/GameAdapter.ts transport/ProducerConnection.ts transport/session.ts \
         vision/contracts.ts vision/FaceObserver.ts vision/signals.ts protocol/types.ts; do
  [[ -f "$web/src/$f" ]] || { echo "missing: web/src/$f" >&2; missing=1; }
done
[[ -f "$web/public/models/face_landmarker.task" ]] || { echo "missing: web/public/models/face_landmarker.task (run: cd web && npm install && npm run setup:assets)" >&2; missing=1; }
compgen -G "$web/public/mediapipe/wasm/*.wasm" >/dev/null || { echo "missing: web/public/mediapipe/wasm/*.wasm (run: cd web && npm run setup:assets)" >&2; missing=1; }
[[ $missing -eq 0 ]] || exit 1

# --- Patch state ---------------------------------------------------------------------------
already=0
if git -C "$game" apply --reverse --check "$patch" >/dev/null 2>&1; then
  already=1
  echo "patch already applied: refreshing vendored code and assets only"
else
  if [[ -n "$(git -C "$game" status --porcelain)" ]]; then
    echo "the game's working tree is not clean; commit or stash first:" >&2
    git -C "$game" status --short >&2
    exit 1
  fi
  git -C "$game" apply --check "$patch" || { echo "memoria-3d.patch does not apply to this checkout" >&2; exit 1; }
fi

# --- Vendored observation modules (copied, never hand-edited) --------------------------
for d in protocol transport vision; do
  mkdir -p "$game/src/observation/vendor/$d"
  rsync -a --delete \
    --exclude '*.test.ts' --exclude '*.spec.ts' --exclude '*verify*' \
    --exclude 'tests/' --exclude '__tests__/' --exclude '.DS_Store' \
    "$web/src/$d/" "$game/src/observation/vendor/$d/"
done
echo "vendored: src/observation/vendor/{protocol,transport,vision}"

# --- Runtime assets (git-ignored in the game) -------------------------------------------
mkdir -p "$game/public/mediapipe/wasm" "$game/public/models"
rsync -a --delete "$web/public/mediapipe/wasm/" "$game/public/mediapipe/wasm/"
cp "$web/public/models/face_landmarker.task" "$game/public/models/face_landmarker.task"
echo "assets: public/mediapipe/wasm, public/models/face_landmarker.task"

# --- Patch --------------------------------------------------------------------------------
if [[ $already -eq 0 ]]; then
  git -C "$game" apply --whitespace=nowarn "$patch"
  echo "applied: memoria-3d.patch"
fi
for f in VisionBridge.ts observation.ts; do if ! cmp -s "$here/$f" "$game/src/observation/$f"; then
  echo "warning: src/observation/$f differs from integrations/memoria-3d/$f (patch out of date?)" >&2
fi; done

# --- Dependency --------------------------------------------------------------------------
version="$(node -p "require('$web/package.json').dependencies['@mediapipe/tasks-vision']")"
if [[ $npm_step -eq 1 ]]; then
  if node -e "process.exit(require('$game/package.json').dependencies?.['@mediapipe/tasks-vision'] === '$version' ? 0 : 1)"; then
    echo "dependency: @mediapipe/tasks-vision@$version already in package.json"
    [[ -d "$game/node_modules/@mediapipe/tasks-vision" ]] || (cd "$game" && npm install --no-audit --no-fund)
  else
    (cd "$game" && npm install --save-exact --no-audit --no-fund --prefer-offline "@mediapipe/tasks-vision@$version")
    echo "dependency: added @mediapipe/tasks-vision@$version"
  fi
else
  echo "skipped npm: run  npm install --save-exact @mediapipe/tasks-vision@$version  in the game"
fi

echo
echo "done. Next: npm run build && npm run check   (in $game)"
