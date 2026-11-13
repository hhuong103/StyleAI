import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text


def test_occasion_fallback_migration_backfills_idempotently():
    path = Path(__file__).parents[1] / "migrations" / "versions" / "0004_occasion_fallback_rules.py"
    spec = importlib.util.spec_from_file_location("occasion_fallback_migration", path)
    assert spec and spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE occasions (code VARCHAR(40) PRIMARY KEY)")
        connection.exec_driver_sql(
            "CREATE TABLE outfit_rules ("
            "id VARCHAR(36) PRIMARY KEY, rule_key VARCHAR(80) NOT NULL, "
            "version INTEGER NOT NULL, occasion_code VARCHAR(40) NOT NULL, "
            "style_code VARCHAR(40), gender VARCHAR(10), slots JSON NOT NULL, "
            "priority INTEGER NOT NULL, active BOOLEAN NOT NULL, "
            "created_at DATETIME NOT NULL, UNIQUE(rule_key, version))"
        )
        connection.execute(
            text("INSERT INTO occasions(code) VALUES (:code)"),
            [{"code": code} for code in migration.FALLBACKS],
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            migration.upgrade()

        rows = connection.execute(
            text("SELECT rule_key, occasion_code, active, slots FROM outfit_rules")
        ).mappings()
        rules = {row["occasion_code"]: row for row in rows}

    assert set(rules) == set(migration.FALLBACKS)
    assert all(rules[occasion]["rule_key"] == f"fallback_{occasion.lower()}" for occasion in rules)
    assert all(rules[occasion]["active"] for occasion in rules)
    assert all(rules[occasion]["slots"] for occasion in rules)
