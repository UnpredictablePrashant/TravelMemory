# IAM Group Setup - admin MERN

This file gives a separate permission list and AWS CLI commands to create a reusable IAM group for MERN deployments like this project.

## Group Name

You requested: `admin MERN`

AWS IAM group names should not use spaces, so use:

- `admin-MERN`

## Separate Permission List

### Core (required for this project scripts)

- **EC2**: start/stop instances, describe resources, modify instance attributes (e.g. attach security groups), security group operations, elastic IP operations, resource tagging (`CreateTags`)
- **ELBv2 (ALB)**: create/delete ALB, listeners, target groups, register/deregister targets, add/remove tags on load balancers and target groups
- **Resource Groups Tagging API** (optional): `tag:GetResources` (and related read actions) to list resources by tag via `automation/list_project_resources.py`
- **CloudWatch**: read ALB request metrics (used by idle auto-stop script)
- **STS**: caller identity check

### Recommended for similar MERN applications

- **Auto Scaling**: create/update/delete ASGs and scaling policies
- **ACM**: request/list/delete certificates for HTTPS on ALB
- **S3**: ALB access log bucket operations
- **IAM PassRole**: attach approved EC2 instance profiles

## Policy File

Use this custom policy JSON:

- `automation/iam/admin-mern-policy.json`

## AWS CLI - Create Group and Attach Policy

```bash
# 1) Create group
aws iam create-group --group-name admin-MERN

# 2) Create customer-managed policy
aws iam create-policy \
  --policy-name admin-MERN-DeploymentPolicy \
  --policy-document file://automation/iam/admin-mern-policy.json

# 3) Attach policy to group
aws iam attach-group-policy \
  --group-name admin-MERN \
  --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/admin-MERN-DeploymentPolicy
```

## Add Users to Group

```bash
aws iam add-user-to-group --user-name <IAM_USER_1> --group-name admin-MERN
aws iam add-user-to-group --user-name <IAM_USER_2> --group-name admin-MERN
```

## Verify

```bash
aws iam get-group --group-name admin-MERN
aws iam list-attached-group-policies --group-name admin-MERN
```

## If you see `AccessDenied` for `elasticloadbalancing:AddTags`

`automation/aws_setup.py` tags the ALB and target group after setup. Your IAM principal must allow **`elasticloadbalancing:AddTags`** (and usually **`RemoveTags`**) on those resources. The file `automation/iam/admin-mern-policy.json` already lists these actions; you still need the **same JSON** (or equivalent) **attached in the AWS account** to the user or group you use for deployment.

**Option A — User `admin` not in the group:** add the user to `admin-MERN` (see above), or attach the customer-managed policy to the user:

```bash
aws iam attach-user-policy \
  --user-name admin \
  --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/admin-MERN-DeploymentPolicy
```

**Option B — Policy exists but is an old version:** publish a new default version from this repo:

```bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/admin-MERN-DeploymentPolicy \
  --policy-document file://automation/iam/admin-mern-policy.json \
  --set-as-default
```

**Option C — Quick inline policy only for ELB tagging** (replace `admin` if needed):

```bash
aws iam put-user-policy \
  --user-name admin \
  --policy-name TravelMemory-ElbTagging \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:AddTags",
        "elasticloadbalancing:RemoveTags"
      ],
      "Resource": "*"
    }]
  }'
```

Then retry `aws_setup.py`. New IAM permissions can take a few seconds to propagate.

## If you see `UnauthorizedOperation` for `ec2:ModifyInstanceAttribute`

Scripts such as `automation/attach_ec2_security_group.py` change which security groups are attached to an instance. IAM must allow **`ec2:ModifyInstanceAttribute`** on those instances. It is included in `automation/iam/admin-mern-policy.json`; publish a new policy version or add an inline policy:

```bash
aws iam put-user-policy \
  --user-name admin \
  --policy-name TravelMemory-ModifyInstanceSg \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "ec2:ModifyInstanceAttribute",
      "Resource": "arn:aws:ec2:*:<ACCOUNT_ID>:instance/*"
    }]
  }'
```

(Replace account ID or use `"Resource": "*"` only if appropriate for your account.)

## Security Notes

- Keep this group only for deployment admins (not application users).
- Enforce MFA for all users in this group.
- For production, scope permissions to specific resource ARNs where possible.
- Use separate lower-privilege groups for read-only monitoring and CI/CD automation.
