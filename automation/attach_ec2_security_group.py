#!/usr/bin/env python3
"""
Attach the app security group from automation/config.yaml to each EC2 in ec2.instance_ids.

Replaces the instance's security group set with only that group (typical for TravelMemory:
SSH 22, HTTP 80, HTTPS 443 per your config). Instances must live in the same VPC as the SG.

Requires: ec2:DescribeInstances, ec2:DescribeSecurityGroups, ec2:ModifyInstanceAttribute
"""

from __future__ import annotations

import argparse
import pathlib
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


def normalize_instance_ids(ec2_cfg: dict[str, Any]) -> list[str]:
    raw = ec2_cfg.get("instance_ids") or []
    if not isinstance(raw, list):
        raise ValueError("ec2.instance_ids must be a list.")
    out: list[str] = []
    for x in raw:
        s = str(x).strip()
        if not s or "xxxx" in s.lower():
            continue
        out.append(s)
    if not out:
        raise ValueError("No valid instance IDs in ec2.instance_ids (add real IDs, not placeholders).")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set each app instance to use only security_group from config (fixes SSH/ALB rules)."
    )
    parser.add_argument("--config", default="automation/config.yaml", help="YAML config path.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned changes only; do not call ModifyInstanceAttribute.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    ec2_cfg = config.get("ec2")
    if not isinstance(ec2_cfg, dict):
        raise ValueError("Config must include an 'ec2' section.")
    sg_cfg = config.get("security_group")
    if not isinstance(sg_cfg, dict) or not sg_cfg.get("name"):
        raise ValueError("Config must include security_group.name.")

    instance_ids = normalize_instance_ids(ec2_cfg)
    sg_name = sg_cfg["name"]

    session = boto3.Session(
        profile_name=config.get("aws_profile"),
        region_name=config.get("aws_region"),
    )
    ec2 = session.client("ec2")

    resp = ec2.describe_instances(InstanceIds=instance_ids)
    instances: list[dict[str, Any]] = []
    for reservation in resp.get("Reservations", []):
        instances.extend(reservation.get("Instances", []))

    if len(instances) != len(instance_ids):
        found = {i["InstanceId"] for i in instances}
        missing = set(instance_ids) - found
        raise RuntimeError(f"Could not describe instances: missing {missing!r}")

    vpc_ids = {i.get("VpcId") for i in instances if i.get("VpcId")}
    if len(vpc_ids) != 1:
        raise RuntimeError(
            f"All instances must be in the same VPC. Found: {vpc_ids}. "
            "Split instance_ids or move instances."
        )
    vpc_id = vpc_ids.pop()

    sgr = ec2.describe_security_groups(
        Filters=[
            {"Name": "group-name", "Values": [sg_name]},
            {"Name": "vpc-id", "Values": [vpc_id]},
        ]
    )["SecurityGroups"]
    if not sgr:
        raise RuntimeError(
            f"No security group named {sg_name!r} in VPC {vpc_id}. "
            "Create it (run automation/aws_setup.py) in this VPC, or fix security_group.name."
        )
    sg_id = sgr[0]["GroupId"]
    print(f"Using security group {sg_id} ({sg_name}) in {vpc_id}")

    for inst in instances:
        iid = inst["InstanceId"]
        current = [g["GroupId"] for g in inst.get("SecurityGroups", [])]
        if current == [sg_id]:
            print(f"{iid}: already using only {sg_id}; skip")
            continue
        print(f"{iid}: {current} -> [{sg_id}]")
        if not args.dry_run:
            ec2.modify_instance_attribute(InstanceId=iid, Groups=[sg_id])
            print(f"{iid}: updated")

    if args.dry_run:
        print("Dry run only; no changes made.")


if __name__ == "__main__":
    main()
