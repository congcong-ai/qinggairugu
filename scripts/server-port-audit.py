#!/usr/bin/env python3
"""只读审计监听端口与服务配置；不会启动、停止或修改任何服务。"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class PortUse:
    port: int
    state: str
    source: str
    detail: str


def run(command: list[str]) -> str:
    try:
        return subprocess.run(
            command, check=False, capture_output=True, text=True, timeout=15
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return ""


def add(result: set[PortUse], port: int, state: str, source: str, detail: str) -> None:
    if 1 <= port <= 65535:
        result.add(PortUse(port, state, source, detail[:240]))


def inspect_process(pid: int) -> str:
    parts: list[str] = []
    for label, path in (
        ("cwd", f"/proc/{pid}/cwd"),
        ("comm", f"/proc/{pid}/comm"),
        ("cgroup", f"/proc/{pid}/cgroup"),
    ):
        try:
            if label == "cwd":
                value = os.readlink(path)
            else:
                value = open(path, "rb").read(4096).replace(b"\x00", b" ").decode("utf-8", "replace").strip()
            if value:
                parts.append(f"{label}={value}")
        except OSError:
            continue
    return "; ".join(parts)


def listening_uses() -> set[PortUse]:
    result: set[PortUse] = set()
    output = run(["ss", "-H", "-lntup"])
    for line in output.splitlines():
        columns = line.split()
        if len(columns) < 5:
            continue
        local = columns[4]
        match = re.search(r":(\d+)$", local)
        if not match:
            continue
        port = int(match.group(1))
        pid_match = re.search(r"pid=(\d+)", line)
        pid_detail = inspect_process(int(pid_match.group(1))) if pid_match else ""
        add(result, port, "LISTEN", "ss", f"{line}; {pid_detail}".strip("; "))
    return result


def configured_uses() -> set[PortUse]:
    result: set[PortUse] = set()
    sources: list[tuple[str, str]] = []
    nginx_dump = run(["nginx", "-T"])
    if nginx_dump:
        sources.append(("nginx -T", nginx_dump))
    for pattern in (
        "/etc/nginx/sites-available/*",
        "/etc/supervisor/conf.d/*",
        "/etc/systemd/system/*.service",
    ):
        for path in glob.glob(pattern):
            try:
                sources.append((path, open(path, encoding="utf-8", errors="replace").read()))
            except OSError:
                continue

    for source, content in sources:
        for match in re.finditer(r"\blisten\s+(?:\[[^]]+\]|[\w.*-]+:)?(\d+)\b", content):
            add(result, int(match.group(1)), "CONFIG", source, "listen")
        for match in re.finditer(r"\bproxy_pass\s+https?://[^\s;:]+:(\d+)\b", content):
            add(result, int(match.group(1)), "CONFIG", source, "upstream")
        for match in re.finditer(r"\bserver\s+(?:\[[^]]+\]|[\w.*-]+):(\d+)\b", content):
            add(result, int(match.group(1)), "CONFIG", source, "upstream server")
        for match in re.finditer(r"(?:--port(?:=|\s+)|\bPORT=)(\d+)\b", content):
            add(result, int(match.group(1)), "CONFIG", source, "service command")

    for path in glob.glob("/var/lib/*/.pm2/dump.pm2") + glob.glob("/home/*/.pm2/dump.pm2") + ["/root/.pm2/dump.pm2"]:
        try:
            entries = json.load(open(path, encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("name", "unknown"))
            environments = [entry]
            pm2_env = entry.get("pm2_env")
            if isinstance(pm2_env, dict):
                environments.append(pm2_env)
                nested_env = pm2_env.get("env")
                if isinstance(nested_env, dict):
                    environments.append(nested_env)
            for key in ("WEB_PORT", "API_PORT", "PORT"):
                for environment in environments:
                    value = environment.get(key)
                    if isinstance(value, (str, int)) and str(value).isdigit():
                        add(result, int(value), "CONFIG", path, f"PM2 {name} {key}")

    if shutil.which("docker"):
        for line in run(["docker", "ps", "--format", "{{.Names}}|{{.Ports}}"]).splitlines():
            for match in re.finditer(r"(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d+)->", line):
                add(result, int(match.group(1)), "CONFIG", "docker ps", line)
    return result


def collect() -> list[PortUse]:
    return sorted(listening_uses() | configured_uses(), key=lambda item: (item.port, item.state, item.source))


def choose(uses: list[PortUse]) -> int:
    reserved = {item.port for item in uses}
    if not shutil.which("ss") or os.geteuid() != 0:
        raise SystemExit("完整审计需要 Linux root 与 ss；拒绝在信息不完整时推荐端口")
    ephemeral = open("/proc/sys/net/ipv4/ip_local_port_range").read().split()
    low, high = map(int, ephemeral)
    for port in range(10240, 20000):
        if port not in reserved and not low <= port <= high:
            return port
    raise SystemExit("没有找到可用 API 端口")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--choose", action="store_true")
    parser.add_argument("--check", nargs="+", type=int, metavar="PORT")
    parser.add_argument("--suggest-only", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ss") or os.geteuid() != 0:
        raise SystemExit("完整审计需要 Linux root 与 ss")
    uses = collect()

    if args.choose:
        api = choose(uses)
        print(json.dumps({"api_port": api}))
        return

    if args.check:
        requested = set(args.check)
        conflicts = [item for item in uses if item.port in requested]
        if conflicts:
            print(json.dumps({"available": False, "conflicts": [asdict(item) for item in conflicts]}, ensure_ascii=False, indent=2))
            raise SystemExit(1)
        print(json.dumps({"available": True, "ports": args.check}, ensure_ascii=False))
        return

    api = choose(uses)
    print(
        json.dumps(
            {
                "uses": [asdict(item) for item in uses],
                "suggestion": {"api_port": api},
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
