#!/usr/bin/env python3
"""
Stop and optionally delete chargeable AWS resources for TravelMemory.

Default behavior:
- Stop configured EC2 instances.

Optional behavior:
- Delete ALB + listener(s)
- Delete target group
- Delete security group (if no dependencies)
- Release unattached Elastic IPs
"""

from __future__ import annotations

import argparse
import json
import pathlib
from typing import Any

import boto3
import botocore
import yaml


def load_config(path: str) -> dict[str, Any]:
    file_path = pathlib.Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    data = yaml.safe_load(file_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Config must be a YAML object.")
    return data


def stop_running_instances(ec2_client: Any, instance_ids: list[str], wait: bool) -> list[str]:
    if not instance_ids:
        return []
    resp = ec2_client.describe_instances(InstanceIds=instance_ids)
    running = []
    for reservation in resp["Reservations"]:
        for instance in reservation["Instances"]:
            if instance["State"]["Name"] == "running":
                running.append(instance["InstanceId"])
    if running:
        ec2_client.stop_instances(InstanceIds=running)
        if wait:
            ec2_client.get_waiter("instance_stopped").wait(InstanceIds=running)
    return running


def get_load_balancer(elbv2_client: Any, lb_name: str) -> dict[str, Any] | None:
    try:
        lbs = elbv2_client.describe_load_balancers(Names=[lb_name])["LoadBalancers"]
        return lbs[0] if lbs else None
    except botocore.exceptions.ClientError as err:
        if "LoadBalancerNotFound" in str(err):
            return None
        raise


def delete_alb_and_listeners(elbv2_client: Any, lb_arn: str) -> list[str]:
    deleted_listeners: list[str] = []
    listeners = elbv2_client.describe_listeners(LoadBalancerArn=lb_arn)["Listeners"]
    for listener in listeners:
        elbv2_client.delete_listener(ListenerArn=listener["ListenerArn"])
        deleted_listeners.append(listener["ListenerArn"])
    elbv2_client.delete_load_balancer(LoadBalancerArn=lb_arn)
    return deleted_listeners


def delete_target_group(elbv2_client: Any, tg_name: str) -> str | None:
    try:
        tgs = elbv2_client.describe_target_groups(Names=[tg_name])["TargetGroups"]
        if not tgs:
            return None
        tg_arn = tgs[0]["TargetGroupArn"]
        elbv2_client.delete_target_group(TargetGroupArn=tg_arn)
        return tg_arn
    except botocore.exceptions.ClientError as err:
        if "TargetGroupNotFound" in str(err):
            return None
        raise


def find_security_group_id(ec2_client: Any, vpc_id: str | None, sg_name: str) -> str | None:
    filters = [{"Name": "group-name", "Values": [sg_name]}]
    if vpc_id:
        filters.append({"Name": "vpc-id", "Values": [vpc_id]})
    groups = ec2_client.describe_security_groups(Filters=filters)["SecurityGroups"]
    return groups[0]["GroupId"] if groups else None


def delete_security_group_if_possible(ec2_client: Any, sg_id: str) -> tuple[bool, str]:
    try:
        ec2_client.delete_security_group(GroupId=sg_id)
        return True, "deleted"
    except botocore.exceptions.ClientError as err:
        return False, str(err)


def release_unattached_eips(ec2_client: Any) -> list[str]:
    addresses = ec2_client.describe_addresses().get("Addresses", [])
    released: list[str] = []
    for addr in addresses:
        # If association id is missing, EIP is unattached and still chargeable.
        if "AssociationId" not in addr and "AllocationId" in addr:
            ec2_client.release_address(AllocationId=addr["AllocationId"])
            released.append(addr["AllocationId"])
    return released


def main() -> None:
    parser = argparse.ArgumentParser(description="Stop chargeable resources for TravelMemory.")
    parser.add_argument("--config", default="automation/config.yaml", help="YAML config path")
    parser.add_argument("--wait", action="store_true", help="Wait for instance stop completion")
    parser.add_argument(
        "--delete-alb-stack",
        action="store_true",
        help="Delete ALB, listeners, target group, and managed security group.",
    )
    parser.add_argument(
        "--release-unattached-eips",
        action="store_true",
        help="Release unattached Elastic IP addresses in this region.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm destructive actions (required for --delete-alb-stack).",
    )
    args = parser.parse_args()

    if args.delete_alb_stack and not args.yes:
        raise SystemExit("Refusing destructive action. Re-run with --yes.")

    cfg = load_config(args.config)
    session = boto3.Session(
        profile_name=cfg.get("aws_profile"),
        region_name=cfg.get("aws_region"),
    )
    ec2 = session.client("ec2")
    elbv2 = session.client("elbv2")

    output: dict[str, Any] = {
        "instances_stopped": [],
        "alb_deleted": None,
        "listeners_deleted": [],
        "target_group_deleted": None,
        "security_group_delete_result": None,
        "released_eip_allocations": [],
    }

    instance_ids = cfg.get("ec2", {}).get("instance_ids", [])
    output["instances_stopped"] = stop_running_instances(ec2, instance_ids, wait=args.wait)

    if args.delete_alb_stack:
        lb_name = cfg.get("load_balancer", {}).get("name")
        tg_name = cfg.get("target_group", {}).get("name")
        sg_name = cfg.get("security_group", {}).get("name")
        vpc_id = cfg.get("network", {}).get("vpc_id") or None

        if lb_name:
            lb = get_load_balancer(elbv2, lb_name)
            if lb:
                output["listeners_deleted"] = delete_alb_and_listeners(elbv2, lb["LoadBalancerArn"])
                output["alb_deleted"] = lb["LoadBalancerArn"]

        if tg_name:
            output["target_group_deleted"] = delete_target_group(elbv2, tg_name)

        if sg_name:
            sg_id = find_security_group_id(ec2, vpc_id, sg_name)
            if sg_id:
                deleted, message = delete_security_group_if_possible(ec2, sg_id)
                output["security_group_delete_result"] = {
                    "group_id": sg_id,
                    "deleted": deleted,
                    "message": message,
                }

    if args.release_unattached_eips:
        output["released_eip_allocations"] = release_unattached_eips(ec2)

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
