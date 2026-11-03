import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "apps/api"))
from app.main import app

(root / "contracts/openapi.json").write_text(
    json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n"
)
print("Updated contracts/openapi.json")
