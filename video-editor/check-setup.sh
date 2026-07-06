#!/usr/bin/env bash
# check-setup.sh — verify the tools the VIDEO-EDITOR pipeline needs (raw → exported cut).
#
# Report-only: checks what's installed and prints the install command for anything
# missing. Installs NOTHING and touches nothing. Run it once before editing.
#
#   ./check-setup.sh
#
# Cross-platform: macOS, or Windows via WSL2 (Ubuntu), or plain Linux. On Windows you must run
# this from INSIDE WSL (a real bash shell) — see SETUP.md "Windows". The Python side (WhisperX
# large-v3 + torch) is NOT installed here — the rough-cut skill builds its own isolated venv on
# first run (~3–5 GB, several minutes).
set -uo pipefail

# ── platform detection ──────────────────────────────────────────────────────
UNAME="$(uname -s 2>/dev/null || echo unknown)"
case "$UNAME" in
  Darwin) OS=mac;   OSLABEL="macOS" ;;
  Linux)  OS=linux; OSLABEL="Linux" ;;
  *)      OS=other; OSLABEL="$UNAME" ;;
esac
IS_WSL=0
if [ "$OS" = linux ] && grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=1; OSLABEL="Windows · WSL2 (Ubuntu)"
fi

# install-command hint for a given tool, per platform (bash 3.2-safe: case, no assoc arrays)
hint() {  # hint <tool-key>
  case "$OS:$1" in
    mac:ffmpeg)    echo "brew install ffmpeg" ;;
    mac:uv)        echo "brew install uv" ;;
    mac:node)      echo "brew install node" ;;
    mac:python3)   echo "brew install python" ;;
    mac:pillow)    echo "brew install pillow" ;;
    linux:ffmpeg)  echo "sudo apt install -y ffmpeg" ;;
    linux:uv)      echo "curl -LsSf https://astral.sh/uv/install.sh | sh" ;;
    linux:node)    echo "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs" ;;
    linux:python3) echo "sudo apt install -y python3 python3-pip" ;;
    linux:pillow)  echo "sudo apt install -y python3-pil" ;;
    *:higgsfield)  echo "curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh" ;;
    *)             echo "install $1" ;;
  esac
}

if [ -t 1 ]; then
  G=$(tput setaf 2); R=$(tput setaf 1); Y=$(tput setaf 3); D=$(tput setaf 8); B=$(tput bold); N=$(tput sgr0)
else
  G=; R=; Y=; D=; B=; N=
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
missing=0

check() {  # check <cmd> <label> <tool-key> <used-by>
  local cmd="$1" label="$2" key="$3" used="$4"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf "  ${G}✓${N} %-12s ${D}%s${N}\n" "$label" "$used"
  else
    printf "  ${R}✗${N} %-12s ${Y}%s${N}  ${D}(needed by %s)${N}\n" "$label" "$(hint "$key")" "$used"
    missing=$((missing + 1))
  fi
}

note() { printf "  ${Y}!${N} %-12s ${D}%s${N}\n" "$1" "$2"; }
ok()   { printf "  ${G}✓${N} %-12s ${D}%s${N}\n" "$1" "$2"; }

printf "\n${B}video-editor — prerequisites${N}  ${D}(%s)${N}\n\n" "$OSLABEL"

if [ "$OS" = other ]; then
  printf "  ${R}Unsupported shell/OS detected ($UNAME).${N}\n"
  printf "  ${Y}On Windows, run this from inside WSL2 (Ubuntu), not PowerShell/cmd. See SETUP.md \"Windows\".${N}\n\n"
fi

# Package-manager preamble
if [ "$OS" = mac ] && ! command -v brew >/dev/null 2>&1; then
  printf "  ${Y}Homebrew not found${N} — most installs below use it. Install it first:\n"
  printf "    ${B}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${N}\n\n"
elif [ "$OS" = linux ]; then
  printf "  ${D}Installs below use apt. Refresh the index once first:${N}  ${B}sudo apt update${N}\n\n"
fi

printf "${B}Core${N} (the raw → exported pipeline — every job needs these):\n"
check ffmpeg  ffmpeg  ffmpeg  "every audio/video pass: rough-cut, captions, music"
check ffprobe ffprobe ffmpeg  "duration/format probing"
check uv      uv      uv      "rough-cut — builds the WhisperX transcribe venv (also gives uvx)"
check node    node    node    "graphics render engine — npx hyperframes"
check npx     npx     node    "runs the hyperframes CLI"
check python3 python3 python3 "TikTok/raw captions + thumbnail text overlays"

# node version (HyperFrames CLI wants a modern node; 22+)
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
    if [ "$OS" = mac ]; then up="brew upgrade node"; else up="$(hint node)"; fi
    note "node version" "found v$(node -v | tr -d v) — HyperFrames wants node ≥ 22 ($up)"
    missing=$((missing + 1))
  fi
fi

# Pillow (PIL) — the TikTok/raw caption + thumbnail PNG overlays. ffmpeg here has no drawtext/libass, so
# PIL is mandatory for those. (Explainer captions render through HyperFrames, not PIL.)
if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import PIL" >/dev/null 2>&1; then
    ok "Pillow (PIL)" "TikTok/raw captions + thumbnail text overlays"
  else
    note "Pillow (PIL)" "missing — run: $(hint pillow)   (TikTok/raw captions + thumbnail overlays)"
    missing=$((missing + 1))
  fi
fi

printf "\n${B}Fonts${N}  ${D}(all bundled — nothing to install)${N}:\n"
if [ -f "$REPO/assets/fonts/Coolvetica-Rg.otf" ]; then
  ok "Coolvetica" "bundled in assets/fonts/ — explainer captions"
else
  note "Coolvetica" "missing from assets/fonts/ — explainer captions need Coolvetica-Rg.otf"
  missing=$((missing + 1))
fi
if [ -f "$REPO/assets/fonts/Inter-Regular.otf" ]; then
  ok "Inter" "bundled in assets/fonts/ — signature-style + liquid-glass + TikTok/raw graphics"
else
  note "Inter" "missing from assets/fonts/ — graphics display font. Re-download from https://rsms.me/inter"
  missing=$((missing + 1))
fi
if [ "$OS" = mac ]; then
  if ls /Library/Fonts/SF-Pro-Display-*.otf >/dev/null 2>&1 || [ -f /System/Library/Fonts/SFNS.ttf ]; then
    ok "SF Pro (system)" "installed — optional; bundled Inter is the default look"
  else
    note "SF Pro (system)" "not installed (optional) — bundled Inter is the default. Prefer SF Pro? https://developer.apple.com/fonts"
  fi
else
  ok "display font" "bundled Inter is the default on $OSLABEL (SF Pro is macOS-only, not needed)"
fi

printf "\n${B}Optional${N} (only if you use the feature):\n"
check higgsfield higgsfield higgsfield "thumbnail-generator (long-form thumbnails)"
if command -v npm >/dev/null 2>&1 && npm ls -g premiere-pro-mcp >/dev/null 2>&1; then
  ok "premiere-mcp" "installed — to-premiere off-ramp"
else
  note "premiere-mcp" "not installed — only for the Premiere off-ramp: npm i -g premiere-pro-mcp && premiere-pro-mcp --install-cep"
fi
# transcript-QA wordlist (the suspect scan in rough-cut). macOS ships one; minimal Ubuntu/WSL doesn't.
if [ -f /usr/share/dict/words ] || [ -f /usr/share/dict/web2 ] || [ -f /usr/share/dict/american-english ]; then
  ok "wordlist" "present — rough-cut transcript-QA suspect scan"
elif [ "$OS" = linux ]; then
  note "wordlist" "absent — transcript-QA scan will skip. Enable it: sudo apt install -y wamerican"
fi

printf "\n"
if [ "$missing" -eq 0 ]; then
  printf "${G}${B}Core tools present.${N} You're ready to edit.\n"
else
  printf "${R}${B}%d core item(s) missing.${N} Run the commands shown above, then re-run this script.\n" "$missing"
fi

printf "\n${B}One-time, on first use${N} (not installed here — happens automatically / once):\n"
printf "  ${D}•${N} ${B}WhisperX transcription${N} — rough-cut builds its venv + downloads large-v3 (~3–5 GB) on the first edit. Needs network + a few minutes. One time.\n"
printf "  ${D}•${N} ${B}Render engine bootstrap${N} — run once from the project root:  ${B}npx hyperframes@0.7.3 doctor${N}  (downloads the headless browser the graphics renderer uses; pinned to the version the locked presets were built against).\n"
if [ "$IS_WSL" -eq 1 ]; then
  printf "      ${D}On WSL, if the renderer reports a missing shared library, install the headless-Chrome deps it names, e.g.:${N}\n"
  printf "      ${B}sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2t64${N}\n"
fi
printf "  ${D}•${N} ${B}Brand + face refs${N} — fill in ${B}brand-kit.md${N} and drop your photos into ${B}assets/face-refs/${N} before your first job (see SETUP.md).\n\n"

[ "$missing" -eq 0 ]
