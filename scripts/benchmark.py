"""Development-only smoke benchmark. Creates isolated test accounts; no production use."""

import argparse
import concurrent.futures
import json
import secrets
import statistics
import time
from pathlib import Path

import httpx

parser = argparse.ArgumentParser()
parser.add_argument("--origin", default="http://localhost:3000")
parser.add_argument("--users", type=int, default=10, choices=range(1, 11))
parser.add_argument("--output", default="data/reports/benchmark.json")
args = parser.parse_args()
if not args.origin.startswith(("http://localhost:", "http://127.0.0.1:")):
    raise SystemExit("Smoke benchmark only supports a local development origin")


def one_user(index):
    with httpx.Client(base_url=args.origin, timeout=30) as client:
        csrf = client.get("/api/v1/auth/csrf").json()["data"]["csrf_token"]
        client.headers.update({"Origin": args.origin, "X-CSRF-Token": csrf})
        credentials = {
            "email": f"bench-{index}-{secrets.token_hex(6)}@example.com",
            "password": secrets.token_urlsafe(24),
        }
        client.post(
            "/api/v1/auth/register", json={**credentials, "display_name": "Benchmark"}
        ).raise_for_status()
        client.post("/api/v1/auth/login", json=credentials).raise_for_status()
        start = time.perf_counter()
        response = client.get(
            "/api/v1/products?category=SHIRT&available=true&sort=price_asc"
        )
        response.raise_for_status()
        catalog_ms = (time.perf_counter() - start) * 1000
        plan = client.post(
            "/api/v1/stylist/plan",
            json={
                "context": {
                    "occasion": "INTERVIEW",
                    "style": "MINIMAL",
                    "budget_max_vnd": 1500000,
                }
            },
        )
        plan.raise_for_status()
        start = time.perf_counter()
        response = client.post(
            "/api/v1/recommendations", json={"plan_id": plan.json()["data"]["plan_id"]}
        )
        response.raise_for_status()
        recommendation_ms = (time.perf_counter() - start) * 1000
        looks = response.json()["data"]["looks"]
        assert looks and all(
            sum(i["price_vnd"] for i in look["items"])
            == look["total_price_vnd"]
            <= 1500000
            for look in looks
        )
        return catalog_ms, recommendation_ms


with concurrent.futures.ThreadPoolExecutor(max_workers=args.users) as pool:
    samples = list(pool.map(one_user, range(args.users)))


def summary(values):
    return {
        "samples": len(values),
        "p50_ms": round(statistics.median(values), 2),
        "p95_ms": round(sorted(values)[max(0, int(len(values) * 0.95 + 0.999) - 1)], 2),
    }


report = {
    "kind": "local HTTP smoke benchmark; small sample, not a production SLA",
    "concurrent_users": args.users,
    "catalog": summary([s[0] for s in samples]),
    "recommendations": summary([s[1] for s in samples]),
    "budget_violations": 0,
}
path = Path(args.output)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
