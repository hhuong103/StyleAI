"""Install existing, licensed fictional model assets. Never imports merchant products."""

import hashlib
import shutil
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from app.core.config import settings
from app.db.session import SessionLocal
from app.modules.vell.domain_models import ModelPreset


def install_models():
    assets = Path(__file__).resolve().parents[3] / "assets"
    with SessionLocal() as db:
        for slug, name, presentation, filename in (
            ("seo-yeon", "Han Seo-yeon", "FEMALE", "vell-model.png"),
            ("utility", "VELL Utility", "MALE", "vell-male.png"),
            ("minh", "Minh", "MALE", "vell-minh.png"),
            ("marcus", "Marcus", "MALE", "vell-marcus.png"),
            ("alex", "Alex", "MALE", "vell-alex.png"),
            ("linh", "Linh", "FEMALE", "vell-linh.png"),
            ("amara", "Amara", "FEMALE", "vell-amara.png"),
            ("sofia", "Sofia", "FEMALE", "vell-sofia.png"),
        ):
            source = assets / filename
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            key = f"uploads/vell-models/{digest}.png"
            target = settings.media_root / key
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            model_id = str(uuid5(NAMESPACE_URL, f"vell:model:{slug}:{digest}"))
            if db.get(ModelPreset, model_id) is None:
                db.add(
                    ModelPreset(
                        id=model_id,
                        name=name,
                        presentation=presentation,
                        asset_key=key,
                        asset_hash=digest,
                        license_note="Fictional adult model generated for this project with OpenAI ImageGen; see VELL asset provenance.",
                    )
                )
            print(f"{presentation}: {model_id}")
        db.commit()


if __name__ == "__main__":
    install_models()
