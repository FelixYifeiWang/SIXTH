#!/usr/bin/env bash
# Launches the Expo dev server in the current terminal and the Arduino
# keystroke controller in a new Terminal.app window. macOS-only.
#
# Usage:
#   ./dev.sh --serial /dev/tty.usbmodem1101
#   ./dev.sh --wifi 192.168.1.42:4040

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --serial <device> | --wifi <host:port>" >&2
  exit 1
fi

case "$1" in
  --serial|--wifi) ;;
  *)
    echo "Usage: $0 --serial <device> | --wifi <host:port>" >&2
    exit 1
    ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROLLER_CMD="cd $(printf %q "$REPO_ROOT") && python3 firmware/bridge/controller.py $1 $(printf %q "$2")"

osascript <<OSA
tell application "Terminal"
  activate
  do script "${CONTROLLER_CMD}"
end tell
OSA

cd "$REPO_ROOT/mobile"
exec npx expo start
