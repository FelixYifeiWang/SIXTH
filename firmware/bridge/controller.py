"""Keybinding controller for the SIXTH Arduino sketch.

Captures single keystrokes in the terminal and forwards them to the Arduino
over USB serial or a WiFi TCP connection. Keys 1-5 activate the five PWM
outputs (haptics + ventilation) at 2000us; R resets all five to 1500us.

Usage:
    python controller.py --serial /dev/tty.usbmodem1101
    python controller.py --wifi 192.168.1.42:4040

Ctrl-C to quit. Terminal must stay focused to capture keys.
"""

from __future__ import annotations

import argparse
import socket
import sys
import termios
import tty
from contextlib import contextmanager
from typing import Protocol


VALID_KEYS = set("12345Rr")


class Transport(Protocol):
    def send(self, data: bytes) -> None: ...
    def recv_nonblocking(self) -> bytes: ...
    def close(self) -> None: ...


class SerialTransport:
    def __init__(self, port: str, baud: int = 115200) -> None:
        import serial  # pyserial — imported lazily so --wifi doesn't need it

        self._ser = serial.Serial(port, baud, timeout=0)

    def send(self, data: bytes) -> None:
        self._ser.write(data)

    def recv_nonblocking(self) -> bytes:
        waiting = self._ser.in_waiting
        return self._ser.read(waiting) if waiting else b""

    def close(self) -> None:
        self._ser.close()


class WifiTransport:
    def __init__(self, host: str, port: int) -> None:
        self._sock = socket.create_connection((host, port), timeout=5)
        self._sock.setblocking(False)

    def send(self, data: bytes) -> None:
        self._sock.sendall(data)

    def recv_nonblocking(self) -> bytes:
        try:
            return self._sock.recv(4096)
        except BlockingIOError:
            return b""

    def close(self) -> None:
        self._sock.close()


@contextmanager
def raw_terminal():
    fd = sys.stdin.fileno()
    original = termios.tcgetattr(fd)
    try:
        tty.setcbreak(fd)
        yield
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, original)


def parse_wifi_target(value: str) -> tuple[str, int]:
    if ":" not in value:
        raise argparse.ArgumentTypeError("WiFi target must be host:port")
    host, port_str = value.rsplit(":", 1)
    return host, int(port_str)


def build_transport(args: argparse.Namespace) -> Transport:
    if args.serial:
        return SerialTransport(args.serial, baud=args.baud)
    host, port = parse_wifi_target(args.wifi)
    return WifiTransport(host, port)


def run(transport: Transport) -> None:
    print("Controller ready. Keys: 1-5 activate, R reset, Ctrl-C to quit.")
    with raw_terminal():
        while True:
            ch = sys.stdin.read(1)
            if not ch:
                continue
            if ch == "\x03":  # Ctrl-C
                raise KeyboardInterrupt
            if ch not in VALID_KEYS:
                continue
            transport.send(ch.encode("ascii"))
            ack = transport.recv_nonblocking().decode("ascii", errors="replace")
            if ack:
                sys.stdout.write(ack)
                sys.stdout.flush()


def main() -> int:
    parser = argparse.ArgumentParser(description="Forward keystrokes to the SIXTH Arduino over serial or WiFi.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--serial", help="Serial device path, e.g. /dev/tty.usbmodem1101")
    group.add_argument("--wifi", help="WiFi target host:port, e.g. 192.168.1.42:4040")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud (default 115200)")
    args = parser.parse_args()

    transport = build_transport(args)
    try:
        run(transport)
    except KeyboardInterrupt:
        print("\nExiting.")
    finally:
        transport.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
