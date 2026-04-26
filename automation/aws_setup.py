#!/usr/bin/env python3
"""
One-time AWS setup script for TravelMemory deployment.

Creates (or reuses):
- Security Group
- Target Group
- Application Load Balancer
- Listener
- EC2 instances (optional: when ec2.instance_ids is empty and ec2.launch.enabled is true)
- Target registration (EC2 instances)

Configuration is loaded from an external YAML file.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Any

import boto3
import botocore
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


def get_session(config: dict[str, Any]) -> boto3.Session:
    return boto3.Session(
        profile_name=config.get("aws_profile"),
        region_name=config.get("aws_region"),
    )


def project_tag_spec(config: dict[str, Any]) -> tuple[str, str]:
    """Tag key/value applied to SG, ALB, target group, and app EC2 instances."""
    proj = config.get("project") or {}
    key = (proj.get("tag_key") or "Project").strip() or "Project"
    value = (proj.get("tag_value") or "TravelMemory").strip() or "TravelMemory"
    return key, value


def apply_project_tags(
    ec2_client: Any,
    elbv2_client: Any,
    config: dict[str, Any],
    *,
    security_group_id: str,
    target_group_arn: str,
    load_balancer_arn: str,
    instance_ids: list[str],
) -> list[str]:
    """
    Ensure the project tag exists on all managed resources (idempotent).

    Returns human-readable warnings for recoverable errors (e.g. AccessDenied on ELB
    tagging). Setup can still succeed; fix IAM or tag resources in the console and re-run.
    """
    pk, pv = project_tag_spec(config)
    tag_list = [{"Key": pk, "Value": pv}]
    warnings: list[str] = []

    ec2_resources = [security_group_id]
    if instance_ids:
        ec2_resources.extend(instance_ids)
    try:
        ec2_client.create_tags(Resources=ec2_resources, Tags=tag_list)
    except botocore.exceptions.ClientError as err:
        code = err.response.get("Error", {}).get("Code", "")
        if code == "AccessDenied":
            warnings.append(
                "EC2 tagging skipped (AccessDenied). Allow ec2:CreateTags on these resources. "
                f"Detail: {err}"
            )
        else:
            raise

    for arn, label in (
        (target_group_arn, "target group"),
        (load_balancer_arn, "load balancer"),
    ):
        try:
            elbv2_client.add_tags(ResourceArns=[arn], Tags=tag_list)
        except botocore.exceptions.ClientError as err:
            code = err.response.get("Error", {}).get("Code", "")
            if code == "AccessDenied":
                warnings.append(
                    f"ELB tagging skipped for {label} (AccessDenied). Attach a policy that "
                    f"allows elasticloadbalancing:AddTags (see docs/IAM_GROUP_ADMIN_MERN.md). "
                    f"Detail: {err}"
                )
            else:
                raise

    return warnings


def get_default_vpc_and_subnets(ec2_client: Any) -> tuple[str, list[str]]:
    vpcs = ec2_client.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])[
        "Vpcs"
    ]
    if not vpcs:
        raise RuntimeError("No default VPC found. Please provide vpc_id and subnets in config.")
    vpc_id = vpcs[0]["VpcId"]
    subnets = ec2_client.describe_subnets(
        Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
    )["Subnets"]
    subnet_ids = [s["SubnetId"] for s in subnets]
    if len(subnet_ids) < 2:
        raise RuntimeError("ALB requires at least 2 subnets in different AZs.")
    return vpc_id, subnet_ids


def ensure_security_group(ec2_client: Any, config: dict[str, Any], vpc_id: str) -> str:
    sg_cfg = config["security_group"]
    sg_name = sg_cfg["name"]

    existing = ec2_client.describe_security_groups(
        Filters=[
            {"Name": "group-name", "Values": [sg_name]},
            {"Name": "vpc-id", "Values": [vpc_id]},
        ]
    )["SecurityGroups"]
    if existing:
        return existing[0]["GroupId"]

    created = ec2_client.create_security_group(
        GroupName=sg_name,
        Description=sg_cfg["description"],
        VpcId=vpc_id,
    )
    sg_id = created["GroupId"]

    permissions = []
    for rule in sg_cfg.get("ingress_rules", []):
        permissions.append(
            {
                "IpProtocol": rule["protocol"],
                "FromPort": rule["from_port"],
                "ToPort": rule["to_port"],
                "IpRanges": [{"CidrIp": cidr} for cidr in rule["cidr_blocks"]],
            }
        )

    if permissions:
        ec2_client.authorize_security_group_ingress(GroupId=sg_id, IpPermissions=permissions)
    return sg_id


def ensure_target_group(elbv2_client: Any, config: dict[str, Any], vpc_id: str) -> str:
    tg_cfg = config["target_group"]
    tg_name = tg_cfg["name"]
    try:
        response = elbv2_client.describe_target_groups(Names=[tg_name])
        return response["TargetGroups"][0]["TargetGroupArn"]
    except botocore.exceptions.ClientError as err:
        if "TargetGroupNotFound" not in str(err):
            raise

    response = elbv2_client.create_target_group(
        Name=tg_name,
        Protocol=tg_cfg.get("protocol", "HTTP"),
        Port=tg_cfg.get("port", 80),
        VpcId=vpc_id,
        TargetType=tg_cfg.get("target_type", "instance"),
        HealthCheckPath=tg_cfg.get("health_check_path", "/"),
        HealthCheckProtocol=tg_cfg.get("health_check_protocol", "HTTP"),
        Matcher={"HttpCode": "200-399"},
    )
    return response["TargetGroups"][0]["TargetGroupArn"]


def ensure_load_balancer(elbv2_client: Any, config: dict[str, Any], subnet_ids: list[str], sg_id: str) -> dict[str, str]:
    alb_cfg = config["load_balancer"]
    alb_name = alb_cfg["name"]
    try:
        lb = elbv2_client.describe_load_balancers(Names=[alb_name])["LoadBalancers"][0]
        return {"arn": lb["LoadBalancerArn"], "dns": lb["DNSName"]}
    except botocore.exceptions.ClientError as err:
        if "LoadBalancerNotFound" not in str(err):
            raise

    selected_subnets = alb_cfg.get("subnet_ids") or subnet_ids[:2]
    created = elbv2_client.create_load_balancer(
        Name=alb_name,
        Subnets=selected_subnets,
        SecurityGroups=[sg_id],
        Scheme=alb_cfg.get("scheme", "internet-facing"),
        Type="application",
        IpAddressType=alb_cfg.get("ip_address_type", "ipv4"),
    )
    lb = created["LoadBalancers"][0]
    return {"arn": lb["LoadBalancerArn"], "dns": lb["DNSName"]}


def ensure_listener(elbv2_client: Any, config: dict[str, Any], lb_arn: str, tg_arn: str) -> str:
    listener_cfg = config["listener"]
    listeners = elbv2_client.describe_listeners(LoadBalancerArn=lb_arn)["Listeners"]
    for listener in listeners:
        if listener["Port"] == listener_cfg.get("port", 80):
            return listener["ListenerArn"]

    created = elbv2_client.create_listener(
        LoadBalancerArn=lb_arn,
        Protocol=listener_cfg.get("protocol", "HTTP"),
        Port=listener_cfg.get("port", 80),
        DefaultActions=[{"Type": "forward", "TargetGroupArn": tg_arn}],
    )
    return created["Listeners"][0]["ListenerArn"]


def register_targets(elbv2_client: Any, tg_arn: str, instance_ids: list[str], port: int) -> None:
    if not instance_ids:
        raise ValueError("ec2.instance_ids is empty. Add at least one instance ID in config.")
    targets = [{"Id": instance_id, "Port": port} for instance_id in instance_ids]
    elbv2_client.register_targets(TargetGroupArn=tg_arn, Targets=targets)


def _normalize_instance_ids(raw: Any) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("ec2.instance_ids must be a list of strings.")
    out: list[str] = []
    for x in raw:
        s = str(x).strip()
        if not s or _is_placeholder_instance_id(s):
            continue
        out.append(s)
    return out


def _is_placeholder_instance_id(instance_id: str) -> bool:
    lower = instance_id.lower()
    if "xxxx" in lower:
        return True
    return False


def _resolve_ubuntu_22_04_ami(ec2_client: Any) -> str:
    resp = ec2_client.describe_images(
        Owners=["099720109477"],
        Filters=[
            {
                "Name": "name",
                "Values": ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"],
            },
            {"Name": "state", "Values": ["available"]},
            {"Name": "architecture", "Values": ["x86_64"]},
        ],
    )
    images = resp.get("Images", [])
    if not images:
        raise RuntimeError(
            "Could not resolve Ubuntu 22.04 (jammy) amd64 AMI. Set ec2.launch.ami_id in config."
        )
    images.sort(key=lambda im: im["CreationDate"], reverse=True)
    return images[0]["ImageId"]


def _find_launch_tagged_instances(
    ec2_client: Any,
    config: dict[str, Any],
    name_tag: str,
) -> list[str]:
    pk, pv = project_tag_spec(config)
    resp = ec2_client.describe_instances(
        Filters=[
            {"Name": "tag:Name", "Values": [name_tag]},
            {"Name": f"tag:{pk}", "Values": [pv]},
            {
                "Name": "instance-state-name",
                "Values": ["pending", "running", "stopped", "stopping"],
            },
        ]
    )
    ids: list[str] = []
    for reservation in resp.get("Reservations", []):
        for inst in reservation.get("Instances", []):
            ids.append(inst["InstanceId"])
    ids.sort()
    return ids


def _run_app_instances(
    ec2_client: Any,
    *,
    ami_id: str,
    count: int,
    instance_type: str,
    key_name: str,
    sg_id: str,
    subnet_ids: list[str],
    name_tag: str,
    project_tag_key: str,
    project_tag_value: str,
) -> list[str]:
    created: list[str] = []
    for i in range(count):
        subnet_id = subnet_ids[i % len(subnet_ids)]
        response = ec2_client.run_instances(
            ImageId=ami_id,
            MinCount=1,
            MaxCount=1,
            InstanceType=instance_type,
            KeyName=key_name,
            SecurityGroupIds=[sg_id],
            SubnetId=subnet_id,
            TagSpecifications=[
                {
                    "ResourceType": "instance",
                    "Tags": [
                        {"Key": "Name", "Value": name_tag},
                        {"Key": project_tag_key, "Value": project_tag_value},
                    ],
                }
            ],
        )
        created.append(response["Instances"][0]["InstanceId"])
    if created:
        ec2_client.get_waiter("instance_running").wait(InstanceIds=created)
    return created


def ensure_instance_ids(
    ec2_client: Any, config: dict[str, Any], subnet_ids: list[str], sg_id: str
) -> tuple[list[str], str]:
    """
    Resolve EC2 instance IDs from config, or create/reuse launch-tagged instances.

    Returns (instance_ids, source) where source is one of:
    "config", "launch_reused", "launch_created"
    """
    ec2_cfg = config.get("ec2")
    if not isinstance(ec2_cfg, dict):
        raise ValueError("Config must include an 'ec2' object.")

    from_config = _normalize_instance_ids(ec2_cfg.get("instance_ids"))
    if from_config:
        return from_config, "config"

    launch_cfg = ec2_cfg.get("launch") or {}
    if not launch_cfg.get("enabled", False):
        raise ValueError(
            "ec2.instance_ids is empty. Add instance IDs, or set ec2.launch.enabled: true "
            "with ec2.launch.key_name (and optional count, instance_type, ami_id)."
        )

    key_name = launch_cfg.get("key_name")
    if not key_name:
        raise ValueError("ec2.launch.key_name is required when ec2.launch.enabled is true.")

    count = int(launch_cfg.get("count", 2))
    if count < 1:
        raise ValueError("ec2.launch.count must be at least 1.")

    name_tag = launch_cfg.get("name_tag", "travelmemory-app")
    existing = _find_launch_tagged_instances(ec2_client, config, name_tag)
    if len(existing) >= count:
        return existing[:count], "launch_reused"

    needed = count - len(existing)
    ami_id = (launch_cfg.get("ami_id") or "").strip() or _resolve_ubuntu_22_04_ami(ec2_client)
    instance_type = launch_cfg.get("instance_type", "t2.micro")
    pk, pv = project_tag_spec(config)
    new_ids = _run_app_instances(
        ec2_client,
        ami_id=ami_id,
        count=needed,
        instance_type=instance_type,
        key_name=key_name,
        sg_id=sg_id,
        subnet_ids=subnet_ids,
        name_tag=name_tag,
        project_tag_key=pk,
        project_tag_value=pv,
    )
    return existing + new_ids, "launch_created"


def ensure_instances_running(ec2_client: Any, instance_ids: list[str]) -> None:
    if not instance_ids:
        return
    resp = ec2_client.describe_instances(InstanceIds=instance_ids)
    to_start: list[str] = []
    for reservation in resp.get("Reservations", []):
        for inst in reservation.get("Instances", []):
            state = inst.get("State", {}).get("Name", "")
            if state in ("stopped", "stopping"):
                to_start.append(inst["InstanceId"])
    if not to_start:
        return
    ec2_client.start_instances(InstanceIds=to_start)
    ec2_client.get_waiter("instance_running").wait(InstanceIds=to_start)


def main() -> None:
    parser = argparse.ArgumentParser(description="One-time AWS setup for TravelMemory.")
    parser.add_argument(
        "--config",
        default="automation/config.yaml",
        help="Path to YAML configuration file.",
    )
    parser.add_argument(
        "--skip-tagging",
        action="store_true",
        help="Do not apply project tags (skip ec2:CreateTags and ELB AddTags).",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    session = get_session(config)
    ec2 = session.client("ec2")
    elbv2 = session.client("elbv2")

    vpc_id = config.get("network", {}).get("vpc_id")
    subnet_ids = config.get("network", {}).get("subnet_ids", [])
    if not vpc_id or len(subnet_ids) < 2:
        auto_vpc_id, auto_subnets = get_default_vpc_and_subnets(ec2)
        vpc_id = vpc_id or auto_vpc_id
        subnet_ids = subnet_ids or auto_subnets

    sg_id = ensure_security_group(ec2, config, vpc_id)
    instance_ids, instance_source = ensure_instance_ids(ec2, config, subnet_ids, sg_id)
    ensure_instances_running(ec2, instance_ids)
    tg_arn = ensure_target_group(elbv2, config, vpc_id)
    lb_info = ensure_load_balancer(elbv2, config, subnet_ids, sg_id)
    listener_arn = ensure_listener(elbv2, config, lb_info["arn"], tg_arn)
    register_targets(
        elbv2,
        tg_arn=tg_arn,
        instance_ids=instance_ids,
        port=config["target_group"].get("port", 80),
    )

    tagging_warnings: list[str] = []
    if args.skip_tagging:
        tagging_warnings.append("Tagging skipped (--skip-tagging).")
    else:
        tagging_warnings = apply_project_tags(
            ec2,
            elbv2,
            config,
            security_group_id=sg_id,
            target_group_arn=tg_arn,
            load_balancer_arn=lb_info["arn"],
            instance_ids=instance_ids,
        )

    pk, pv = project_tag_spec(config)
    output = {
        "region": config.get("aws_region"),
        "vpc_id": vpc_id,
        "subnet_ids": subnet_ids,
        "security_group_id": sg_id,
        "project_tag_key": pk,
        "project_tag_value": pv,
        "ec2_instance_ids": instance_ids,
        "ec2_instance_source": instance_source,
        "target_group_arn": tg_arn,
        "load_balancer_arn": lb_info["arn"],
        "load_balancer_dns": lb_info["dns"],
        "listener_arn": listener_arn,
        "cloudflare_note": (
            "Create CNAME record: "
            f"{config.get('cloudflare', {}).get('subdomain', 'travel')}"
            " -> "
            f"{lb_info['dns']}"
        ),
    }
    if instance_source != "config":
        output["config_followup"] = (
            "Copy ec2_instance_ids into automation/config.yaml as ec2.instance_ids. "
            "Set ec2.launch.enabled: false before re-running unless you want more VMs."
        )
    if tagging_warnings:
        output["tagging_warnings"] = tagging_warnings

    output_path = pathlib.Path("automation/output/deployment-outputs.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")

    print("AWS setup completed.")
    if tagging_warnings:
        for msg in tagging_warnings:
            print(f"WARNING: {msg}", file=sys.stderr)
    print(json.dumps(output, indent=2))
    print(f"Saved outputs to {output_path}")


if __name__ == "__main__":
    main()
