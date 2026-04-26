#!/usr/bin/env python3
"""
Automatically stop EC2 instances if ALB had no traffic in last N minutes.

Intended usage:
- Run from cron every 5 minutes.
- If total RequestCount in lookback window is <= threshold, stop instances.
"""

from __future__ import annotations

import argparse
import datetime as dt
import pathlib
from typing import Any

import boto3
import yaml


def load_config(path: str) -> dict[str, Any]:
    file_path = pathlib.Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    return yaml.safe_load(file_path.read_text(encoding="utf-8"))


def alb_dimension_value_from_arn(lb_arn: str) -> str:
    marker = "loadbalancer/"
    if marker not in lb_arn:
        raise ValueError(f"Unexpected ALB ARN format: {lb_arn}")
    return lb_arn.split(marker, 1)[1]


def get_lb_arn(elbv2_client: Any, lb_name: str) -> str:
    lb = elbv2_client.describe_load_balancers(Names=[lb_name])["LoadBalancers"][0]
    return lb["LoadBalancerArn"]


def sum_alb_requests(
    cloudwatch_client: Any,
    lb_dimension: str,
    idle_minutes: int,
    period_seconds: int = 300,
) -> float:
    end_time = dt.datetime.now(dt.timezone.utc)
    start_time = end_time - dt.timedelta(minutes=idle_minutes)
    metrics = cloudwatch_client.get_metric_statistics(
        Namespace="AWS/ApplicationELB",
        MetricName="RequestCount",
        Dimensions=[{"Name": "LoadBalancer", "Value": lb_dimension}],
        StartTime=start_time,
        EndTime=end_time,
        Period=period_seconds,
        Statistics=["Sum"],
    )
    datapoints = metrics.get("Datapoints", [])
    return float(sum(dp.get("Sum", 0.0) for dp in datapoints))


def running_instances(ec2_client: Any, instance_ids: list[str]) -> list[str]:
    resp = ec2_client.describe_instances(InstanceIds=instance_ids)
    ids: list[str] = []
    for reservation in resp["Reservations"]:
        for instance in reservation["Instances"]:
            if instance["State"]["Name"] == "running":
                ids.append(instance["InstanceId"])
    return ids


def main() -> None:
    parser = argparse.ArgumentParser(description="Auto-stop TravelMemory instances when idle.")
    parser.add_argument("--config", default="automation/config.yaml", help="YAML config path")
    args = parser.parse_args()

    cfg = load_config(args.config)
    session = boto3.Session(
        profile_name=cfg.get("aws_profile"),
        region_name=cfg.get("aws_region"),
    )
    ec2 = session.client("ec2")
    elbv2 = session.client("elbv2")
    cloudwatch = session.client("cloudwatch")

    instance_ids = cfg.get("ec2", {}).get("instance_ids", [])
    if not instance_ids:
        raise ValueError("No instance IDs found in ec2.instance_ids.")

    idle_cfg = cfg.get("cost_control", {})
    idle_minutes = int(idle_cfg.get("auto_stop_idle_minutes", 15))
    request_threshold = float(idle_cfg.get("request_threshold", 0))

    lb_name = cfg.get("load_balancer", {}).get("name")
    if not lb_name:
        raise ValueError("load_balancer.name is required for idle traffic check.")

    lb_arn = get_lb_arn(elbv2, lb_name)
    lb_dimension = alb_dimension_value_from_arn(lb_arn)
    total_requests = sum_alb_requests(cloudwatch, lb_dimension, idle_minutes)

    active_instances = running_instances(ec2, instance_ids)
    print(f"ALB requests in last {idle_minutes}m: {total_requests}")
    print(f"Running instances: {active_instances}")

    if total_requests <= request_threshold and active_instances:
        ec2.stop_instances(InstanceIds=active_instances)
        print(f"No/low traffic detected. Stop requested for {active_instances}")
    else:
        print("Traffic present or no running instances; nothing to stop.")


if __name__ == "__main__":
    main()
