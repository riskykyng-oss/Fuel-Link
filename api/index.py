"""Vercel serverless entry point for the FuelLink FastAPI backend."""

import os
import sys

# Add the backend directory to the Python path so imports work.
_backend = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from mangum import Mangum  # noqa: E402
from app.main import app  # noqa: E402

handler = Mangum(app, lifespan="auto")
