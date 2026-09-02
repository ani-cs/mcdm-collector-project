import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    # Default: any Bearer token is treated as a valid, logged-in admin —
    # individual tests override mock.auth.get_user to exercise 401s.
    fake_user = MagicMock(id="test-admin-id", email="admin@example.com")
    mock.auth.get_user.return_value = MagicMock(user=fake_user)
    app.state.supabase = mock
    return mock

@pytest.fixture
def client(mock_supabase):
    c = TestClient(app)
    c.headers.update({"Authorization": "Bearer test-token"})
    return c

@pytest.fixture
def unauthenticated_client(mock_supabase):
    return TestClient(app)