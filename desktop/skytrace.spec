# PyInstaller spec for the SkyTrace AI desktop app (one-file executable).
# Build from the repository root after building the frontend with VITE_API_BASE_URL=/ :
#   pyinstaller desktop/skytrace.spec --noconfirm
# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

ROOT = Path(SPECPATH).parent  # noqa: F821  (SPECPATH is provided by PyInstaller)
sys.path.insert(0, str(ROOT / "backend"))  # so collect_submodules("app") can import it

hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("app")
    + collect_submodules("pyproj")
)
datas = [(str(ROOT / "frontend" / "dist"), "frontend_dist")]
datas += collect_data_files("pyproj")  # PROJ database (proj.db) and grids

a = Analysis(  # noqa: F821
    [str(ROOT / "desktop" / "launcher.py")],
    pathex=[str(ROOT / "backend")],
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["pytest", "httpx", "tkinter", "IPython"],
    noarchive=False,
)
pyz = PYZ(a.pure)  # noqa: F821
exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SkyTraceAI",
    console=True,
    upx=False,
    runtime_tmpdir=None,
)
