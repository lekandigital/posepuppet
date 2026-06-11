#!/usr/bin/env python3
"""Validate generated-avatar registry safety invariants."""

from __future__ import annotations

import argparse
import json
import re

from common_avatar_pipeline import REPO_ROOT


REGISTRY = REPO_ROOT / "src" / "rig" / "generatedAvatarRegistry.ts"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if not args.validate_only:
        raise SystemExit("This helper is currently validate-only; edit registry intentionally after candidate validation.")
    text = REGISTRY.read_text()
    slugs = re.findall(r"id:\s*'([^']+)'", text)
    errors = []
    if "enabledInUi: true" in text:
        errors.append("generated registry must not enable public UI")
    if "warningLabel: 'experimental'" not in text:
        errors.append("generated registry entries must carry experimental warning labels")
    profiles = re.findall(r"profile:\s*'([^']+)'", text)
    invalid_profiles = sorted(set(profiles) - {"humanoid", "creature", "hand_only"})
    if invalid_profiles:
        errors.append("invalid profiles: " + ", ".join(invalid_profiles))
    payload = {"status": "fail" if errors else "pass", "slugs": slugs, "errors": errors}
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
