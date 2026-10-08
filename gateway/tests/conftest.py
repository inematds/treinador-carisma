import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app as gw  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def cliente():
    gw.limpar_cache()
    with TestClient(gw.app) as c:
        yield c
    gw.limpar_cache()
