"""Vercel Python entrypoint: expose FastAPI as a same-origin /api serverless function."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
from source.api.AppAPI import app  # noqa: E402
