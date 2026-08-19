"""Vercel serverless entry point for the FuelLink FastAPI backend."""

import os
import sys

# backend/ is one directory above api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from mangum import Mangum  # noqa: E402
from app.main import app  # noqa: E402

handler = Mangum(app, lifespan="auto")
