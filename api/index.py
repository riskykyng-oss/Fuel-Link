"""Vercel serverless entry point for the FuelLink FastAPI backend."""

import sys
import os

# Add the backend directory to the Python path so imports work.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402

# Vercel expects a variable named `app` at module level.
