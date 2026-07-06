#!/usr/bin/env bash
# SessionStart hook — on a fresh, un-personalized install, inject a reminder telling Claude to run the
# onboarding/setup flow (CLAUDE.md "FIRST RUN" gate) before doing anything else. Emits NOTHING once setup
# is done. Always exits 0 so it can never break a session.
#
# Pure bash + printf on purpose — NO jq / python dependency, because on a brand-new Mac (or fresh
# WSL2/Ubuntu) those may not be installed yet, and this is the very hook that's supposed to get them
# installed. Runs on macOS, Linux, and inside WSL2 (all have bash). On NATIVE Windows there is no bash
# so this hook never fires — the "install WSL2 first" front door for that case lives in CLAUDE.md.
#
# cwd is the project root (where brand-kit.md and .claude/ live). "Fresh" = brand-kit.md still has the
# <<FILL_ME>> placeholder tokens that "apply my brand kit" replaces.

if [ -f brand-kit.md ] && grep -q '<<' brand-kit.md 2>/dev/null; then
  # NOTE: newlines below are the literal two-character sequence \n (valid JSON string escapes); printf %s
  # passes them through verbatim, and there are no " or \ chars in the message to break the JSON.
  msg='⚠️ FRESH INSTALL — this video editor is NOT set up yet (brand-kit.md still has <<...>> placeholder tokens).\n\nBefore editing ANY video, run the FIRST RUN onboarding gate in CLAUDE.md:\n  1. Run ./check-setup.sh — it prints the exact install command for THIS OS (Homebrew on macOS, apt on Linux/WSL2). For each missing tool, offer to run that command and, on a yes, execute it. Re-run ./check-setup.sh until all core tools pass.\n  2. Bootstrap the render engine once: npx hyperframes@0.7.3 doctor\n  3. Walk the user through brand-kit.md Part A, then apply it per Part B.\n\nDo NOT start an edit job until brand-kit.md has no <<...>> tokens left. If the user asks to edit a video right now, run setup first.'
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
fi

exit 0
