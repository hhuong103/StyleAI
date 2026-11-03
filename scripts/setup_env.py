"""Create private local configuration; never overwrite an existing .env."""

import os
import secrets
from pathlib import Path

path = Path(__file__).resolve().parent.parent / ".env"
if path.exists():
    raise SystemExit(".env already exists; no settings changed.")
content = (
    "APP_ENV=development\nAPP_ORIGIN=http://localhost:3000\nWEB_PORT=3000\nPOSTGRES_USER=fashion\nPOSTGRES_DB=fashion\n"
    f"POSTGRES_PASSWORD={secrets.token_hex(24)}\nJWT_SECRET={secrets.token_hex(48)}\n"
    "ACCESS_TOKEN_TTL=900\nREFRESH_TOKEN_TTL=604800\nLLM_ENABLED=false\n"
)
descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w") as file:
    file.write(content)
print("Created .env with random local secrets. Values are not printed.")
