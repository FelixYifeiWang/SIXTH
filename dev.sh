#!/usr/bin/env bash
# Launches the Expo dev server in the current terminal and the Arduino
# keystroke controller in a new Terminal.app window. macOS-only.
#
# Defaults (serial device, WiFi target, transport choice) come from
# .board.conf at the repo root; copy .board.conf.example and edit.
#
# Usage:
#   ./dev.sh                              # uses DEFAULT_TRANSPORT from .board.conf
#   ./dev.sh --serial                     # uses SERIAL_PORT from .board.conf
#   ./dev.sh --wifi                       # uses WIFI_TARGET from .board.conf
#   ./dev.sh --serial /dev/tty.usbmodemX  # explicit override
#   ./dev.sh --wifi   192.168.1.42:4040   # explicit override

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SERIAL_PORT=""
WIFI_TARGET=""
DEFAULT_TRANSPORT=""

if [[ -f "$REPO_ROOT/.board.conf" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.board.conf"
fi

usage() {
  echo "Usage: $0 [--serial [<device>] | --wifi [<host:port>]]" >&2
  echo "  With no args, uses DEFAULT_TRANSPORT from .board.conf." >&2
  echo "  See .board.conf.example for the expected fields." >&2
}

MODE=""
VALUE=""

if [[ $# -eq 0 ]]; then
  if [[ -z "$DEFAULT_TRANSPORT" ]]; then
    echo "Error: no args given and DEFAULT_TRANSPORT not set in .board.conf" >&2
    usage
    exit 1
  fi
  MODE="--$DEFAULT_TRANSPORT"
elif [[ $# -eq 1 ]]; then
  MODE="$1"
elif [[ $# -eq 2 ]]; then
  MODE="$1"
  VALUE="$2"
else
  usage
  exit 1
fi

case "$MODE" in
  --serial)
    [[ -z "$VALUE" ]] && VALUE="${SERIAL_PORT:-}"
    if [[ -z "$VALUE" ]]; then
      echo "Error: no device given and SERIAL_PORT not set in .board.conf" >&2
      exit 1
    fi
    ;;
  --wifi)
    [[ -z "$VALUE" ]] && VALUE="${WIFI_TARGET:-}"
    if [[ -z "$VALUE" ]]; then
      echo "Error: no host:port given and WIFI_TARGET not set in .board.conf" >&2
      exit 1
    fi
    ;;
  *)
    usage
    exit 1
    ;;
esac

CONTROLLER_CMD="cd $(printf %q "$REPO_ROOT") && python3 firmware/bridge/controller.py $MODE $(printf %q "$VALUE")"

osascript <<OSA
tell application "Terminal"
  activate
  do script "${CONTROLLER_CMD}"
end tell
OSA

cd "$REPO_ROOT/mobile"
exec npx expo start
