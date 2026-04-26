#!/usr/bin/env python3
"""Start TravelMemory EC2 instances from external YAML config."""

from __future__ import annotations

import argparse
import json
import pathlib
from typing import Any

import boto3
import yaml


def load_config(path: str) -> dict[str, Any]:
    file_path = pathlib.Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    return yaml.safe_load(file_path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Start EC2 instances for TravelMemory.")
    parser.add_argument("--config", default="automation/config.yaml", help="YAML config path")
    parser.add_argument("--wait", action="store_true", help="Wait until all instances are running")
    args = parser.parse_args()

    cfg = load_config(args.config)
    session = boto3.Session(
        profile_name=cfg.get("aws_profile"),
        region_name=cfg.get("aws_region"),
    )
    ec2 = session.client("ec2")
    instance_ids = cfg.get("ec2", {}).get("instance_ids", [])
    if not instance_ids:
        raise ValueError("No instance IDs found in ec2.instance_ids.")

    resp = ec2.describe_instances(InstanceIds=instance_ids)
    state_map: dict[str, str] = {}
    for reservation in resp["Reservations"]:
        for instance in reservation["Instances"]:
            state_map[instance["InstanceId"]] = instance["State"]["Name"]

    to_start = [iid for iid, state in state_map.items() if state in {"stopped", "stopping"}]
    already_running = [iid for iid, state in state_map.items() if state == "running"]

    if to_start:
        ec2.start_instances(InstanceIds=to_start)
        print(f"Start requested for: {to_start}")
        if args.wait:
            ec2.get_waiter("instance_running").wait(InstanceIds=to_start)
            print("Instances are running.")
    else:
        print("No stopped instances found.")

    final = ec2.describe_instances(InstanceIds=instance_ids)
    output = []
    for reservation in final["Reservations"]:
        for instance in reservation["Instances"]:
            output.append(
                {
                    "instance_id": instance["InstanceId"],
                    "state": instance["State"]["Name"],
                    "public_ip": instance.get("PublicIpAddress"),
                    "private_ip": instance.get("PrivateIpAddress"),
                }
            )

    print("Already running:", already_running)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
