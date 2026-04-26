#!/usr/bin/env python3
"""List AWS resources tagged with the project tag from automation/config.yaml."""

from __future__ import annotations

import argparse
import pathlib
from collections import defaultdict
from typing import Any

import boto3
import yaml


def load_config(config_path: str) -> dict[str, Any]:
    path = pathlib.Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError("Config file must contain a YAML object.")
    return data


def project_tag_spec(config: dict[str, Any]) -> tuple[str, str]:
    proj = config.get("project") or {}
    key = (proj.get("tag_key") or "Project").strip() or "Project"
    value = (proj.get("tag_value") or "TravelMemory").strip() or "TravelMemory"
    return key, value


def main() -> None:
    parser = argparse.ArgumentParser(
        description="List resources tagged with project.tag_key / project.tag_value from config."
    )
    parser.add_argument(
        "--config",
        default="automation/config.yaml",
        help="Path to YAML configuration file.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    session = boto3.Session(
        profile_name=config.get("aws_profile"),
        region_name=config.get("aws_region"),
    )
    tag_key, tag_value = project_tag_spec(config)
    client = session.client("resourcegroupstaggingapi")

    paginator = client.get_paginator("get_resources")
    by_service: dict[str, list[str]] = defaultdict(list)

    for page in paginator.paginate(
        TagFilters=[{"Key": tag_key, "Values": [tag_value]}],
    ):
        for item in page.get("ResourceTagMappingList", []):
            arn = item.get("ResourceARN", "")
            if not arn:
                continue
            parts = arn.split(":", 5)
            svc = parts[2] if len(parts) > 2 else "unknown"
            by_service[svc].append(arn)

    print(f"Tag filter: {tag_key}={tag_value}")
    print(f"Region: {config.get('aws_region')}")
    total = sum(len(v) for v in by_service.values())
    print(f"Total resources: {total}\n")

    for svc in sorted(by_service.keys()):
        arns = sorted(by_service[svc])
        print(f"[{svc}] ({len(arns)})")
        for arn in arns:
            print(f"  {arn}")
        print()


if __name__ == "__main__":
    main()
