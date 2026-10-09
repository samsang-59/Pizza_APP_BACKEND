"""Write the OpenAPI schema to backend/openapi.json (or a path given as argv[1]).

Usage (from backend/):  python scripts/export_openapi.py [output_path]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND_DIR / "openapi.json"
    out.write_text(json.dumps(app.openapi(), indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
