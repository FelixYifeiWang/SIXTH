"""Shared serial/WiFi transports for the SIXTH bridge scripts.

Both controller.py (keystroke forwarder) and diagnose.py (board smoke test)
talk to the Arduino over either USB serial or a TCP socket. The transport
classes implement a tiny Protocol so the callers can stay transport-agnostic.
"""

from __future__ import annotations

import argparse
import socket
from typing import Protocol


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


def parse_wifi_target(value: str) -> tuple[str, int]:
    if ":" not in value:
        raise argparse.ArgumentTypeError("WiFi target must be host:port")
    host, port_str = value.rsplit(":", 1)
    return host, int(port_str)


def add_transport_args(parser: argparse.ArgumentParser) -> None:
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--serial", help="Serial device path, e.g. /dev/tty.usbmodem1101")
    group.add_argument("--wifi", help="WiFi target host:port, e.g. 192.168.1.42:4040")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud (default 115200)")


def build_transport(args: argparse.Namespace) -> Transport:
    if args.serial:
        return SerialTransport(args.serial, baud=args.baud)
    host, port = parse_wifi_target(args.wifi)
    return WifiTransport(host, port)
