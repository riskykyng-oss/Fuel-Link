"""Development entrypoint: python run.py [--no-reload]

--no-reload runs a single stable process (no uvicorn reloader subprocess) —
the mode the detached start script uses so the API survives its console.

Prefer start_backend.ps1 / start_backend.bat over launching this directly.
"""

import sys

import uvicorn

if __name__ == "__main__":
    unknown = [a for a in sys.argv[1:] if a not in {"--reload", "--no-reload"}]
    if unknown:
        print("usage: python run.py [--reload|--no-reload]", file=sys.stderr)
        sys.exit(2)
    reload_mode = "--no-reload" not in sys.argv[1:]
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_mode,
    )
