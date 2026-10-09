"""SkyTrace AI desktop launcher.

Starts the SkyTrace backend (which also serves the built dashboard) on a free
local port and opens it in the default web browser. Close this window (or press
Ctrl+C) to stop it. Works both from source and inside a PyInstaller bundle.

Prototype for demonstration. Not for operational search-and-rescue decisions.
"""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
REPO_ROOT = Path(__file__).resolve().parents[1]
BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", REPO_ROOT))


def frontend_dist() -> Path:
    return BUNDLE_ROOT / "frontend_dist" if FROZEN else REPO_ROOT / "frontend" / "dist"


def pick_port(preferred: int) -> int:
    """Use the preferred port if free, otherwise any free port."""
    for candidate in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", candidate))
            except OSError:
                continue
            return s.getsockname()[1]
    raise RuntimeError("No free local port available")


def open_when_ready(url: str, timeout_s: float = 30.0) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=1) as r:
                if r.status == 200:
                    break
        except OSError:
            time.sleep(0.25)
    if os.environ.get("SKYTRACE_NO_BROWSER") != "1":
        webbrowser.open(url)


def main() -> int:
    dist = frontend_dist()
    if not (dist / "index.html").is_file():
        print(f"[SkyTrace] Built dashboard not found at {dist}.")
        print("[SkyTrace] From source, build it first:  cd frontend && VITE_API_BASE_URL=/ npm run build")
        return 1

    os.environ["SERVE_FRONTEND"] = "true"
    os.environ["FRONTEND_DIST"] = str(dist)
    os.environ.setdefault("APP_ENV", "desktop")
    os.environ.setdefault("LOG_LEVEL", "WARNING")
    if not FROZEN:
        sys.path.insert(0, str(REPO_ROOT / "backend"))

    # Import only after the environment is configured (settings are read at import).
    import uvicorn

    from app.main import app

    port = pick_port(int(os.environ.get("PORT", "8000")))
    url = f"http://127.0.0.1:{port}"
    print("=" * 64)
    print("  SkyTrace AI  -  Every coordinate matters.")
    print(f"  Open in your browser:  {url}")
    print("  Keep this window open while using the app; close it to quit.")
    print("  Prototype for demonstration. Not for operational SAR decisions.")
    print("=" * 64, flush=True)

    threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False))
    try:
        server.run()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
