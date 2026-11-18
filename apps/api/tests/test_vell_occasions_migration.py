import importlib.util
import json
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text


def test_vell_taxonomy_migration_adds_distinct_context_rules_once():
    path = Path(__file__).parents[1] / "migrations" / "versions" / "0005_vell_occasions.py"
    spec = importlib.util.spec_from_file_location("vell_occasions_migration", path)
    assert spec and spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE categories (code VARCHAR(40) PRIMARY KEY, label VARCHAR(80), item_role VARCHAR(20), active BOOLEAN)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE occasions (code VARCHAR(40) PRIMARY KEY, label VARCHAR(80), active BOOLEAN)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE outfit_rules (id VARCHAR(36) PRIMARY KEY, rule_key VARCHAR(80), "
            "version INTEGER, occasion_code VARCHAR(40), style_code VARCHAR(40), gender VARCHAR(10), "
            "slots JSON, priority INTEGER, active BOOLEAN, created_at DATETIME, UNIQUE(rule_key, version))"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            migration.upgrade()
        occasions = set(connection.execute(text("SELECT code FROM occasions")).scalars())
        categories = set(connection.execute(text("SELECT code FROM categories")).scalars())
        rules = list(
            connection.execute(
                text("SELECT rule_key, occasion_code, slots FROM outfit_rules")
            ).mappings()
        )

    assert occasions == set(migration.OCCASIONS)
    assert categories == set(migration.CATEGORIES)
    assert len(rules) == 8
    assert len({rule["rule_key"] for rule in rules}) == 8
    assert set(rule["occasion_code"] for rule in rules) == occasions
    assert all(json.loads(rule["slots"]) for rule in rules)
