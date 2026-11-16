from contextlib import contextmanager
from types import SimpleNamespace

from app import main


class FakeConnection:
    def __init__(self, revision):
        self.revision = revision

    def scalar(self, _query):
        return self.revision


class FakeEngine:
    def __init__(self, revision):
        self.revision = revision

    @contextmanager
    def connect(self):
        yield FakeConnection(self.revision)


def test_ready_accepts_current_migration_head(monkeypatch):
    monkeypatch.setattr(main, "engine", FakeEngine(main.migration_head()))
    request = SimpleNamespace(state=SimpleNamespace(request_id="test"))

    assert main.ready(request) == {"status": "ready"}


def test_ready_rejects_outdated_migration(monkeypatch):
    monkeypatch.setattr(main, "engine", FakeEngine("0003"))
    request = SimpleNamespace(state=SimpleNamespace(request_id="test"))

    assert main.ready(request).status_code == 503
