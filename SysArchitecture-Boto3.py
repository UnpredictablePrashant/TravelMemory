import boto3
import os

# Initialize Boto3 clients
region = 'ap-south-1'
ec2 = boto3.resource('ec2', region_name=region)
ec2_client = boto3.client('ec2', region_name=region)
ssm_client = boto3.client('ssm', region_name=region)

print("1. Creating VPC and Subnets (256 Total IPs)...")
# A /24 CIDR provides exactly 256 IPs. 
vpc = ec2.create_vpc(CidrBlock='10.0.0.0/24')
vpc.create_tags(Tags=[{"Key": "Name", "Value": "TM-VPC"}])
vpc.wait_until_available()

# Enable DNS Hostnames
ec2_client.modify_vpc_attribute(VpcId=vpc.id, EnableDnsSupport={'Value': True})
ec2_client.modify_vpc_attribute(VpcId=vpc.id, EnableDnsHostnames={'Value': True})

# Splitting the /24 into two /25 subnets (128 IPs each)
public_subnet = ec2.create_subnet(CidrBlock='10.0.0.0/25', VpcId=vpc.id, AvailabilityZone=f'{region}a')
public_subnet.create_tags(Tags=[{"Key": "Name", "Value": "TM-Public-Subnet"}])

private_subnet = ec2.create_subnet(CidrBlock='10.0.0.128/25', VpcId=vpc.id, AvailabilityZone=f'{region}b')
private_subnet.create_tags(Tags=[{"Key": "Name", "Value": "TM-Private-Subnet"}])

print("2. Configuring Internet Gateway & Routing...")
igw = ec2.create_internet_gateway()
vpc.attach_internet_gateway(InternetGatewayId=igw.id)

public_route_table = vpc.create_route_table()
public_route_table.create_route(DestinationCidrBlock='0.0.0.0/0', GatewayId=igw.id)
public_route_table.associate_with_subnet(SubnetId=public_subnet.id)

print("3. Setting up Security Groups...")
public_sg = ec2.create_security_group(GroupName='TM-public-sg', Description='Allow SSH', VpcId=vpc.id)
public_sg.authorize_ingress(IpPermissions=[{'IpProtocol': 'tcp', 'FromPort': 22, 'ToPort': 22, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]}])

# Securely chain the private SG to only accept traffic from the public SG
private_sg = ec2.create_security_group(GroupName='TM-private-sg', Description='Allow SSH from Public', VpcId=vpc.id)
private_sg.authorize_ingress(IpPermissions=[{'IpProtocol': 'tcp', 'FromPort': 22, 'ToPort': 22, 'UserIdGroupPairs': [{'GroupId': public_sg.group_id}]}])

print("4. Creating a New SSH Key Pair...")
key_name = 'TM-ubuntu-2604-keypair'

# Clean up local file if re-running the script
try:
    ec2_client.delete_key_pair(KeyName=key_name)
    if os.path.exists(f'{key_name}.pem'):
        os.remove(f'{key_name}.pem')
except Exception:
    pass

key_pair = ec2.create_key_pair(KeyName=key_name)
with open(f'{key_name}.pem', 'w') as key_file:
    key_file.write(key_pair.key_material)
# Secure the file so SSH doesn't reject it for being too open
os.chmod(f'{key_name}.pem', 0o400) 

print("5. Fetching Latest Ubuntu 26.04 LTS AMI...")
ami_parameter = ssm_client.get_parameter(
    Name='/aws/service/canonical/ubuntu/server/resolute/stable/current/amd64/hvm/ebs-gp3/ami-id'
)
ubuntu_2604_ami = ami_parameter['Parameter']['Value']
print(f"   Found AMI ID: {ubuntu_2604_ami}")

print("6. Launching Instances (8GB gp3 storage)...")
# Storage Configuration
block_device_mappings = [{
    'DeviceName': '/dev/sda1',
    'Ebs': {
        'VolumeSize': 8,
        'VolumeType': 'gp3'
    }
}]

# Provision 1 Public EC2
public_ec2 = ec2.create_instances(
    ImageId=ubuntu_2604_ami,
    InstanceType='t2.micro',
    MinCount=1, MaxCount=1,
    KeyName=key_name,
    NetworkInterfaces=[{
        'SubnetId': public_subnet.id,
        'DeviceIndex': 0,
        'AssociatePublicIpAddress': True,
        'Groups': [public_sg.group_id]
    }],
    BlockDeviceMappings=block_device_mappings,
    TagSpecifications=[{'ResourceType': 'instance', 'Tags': [{'Key': 'Name', 'Value': 'TM-Frontend-01'}]}]
)

# Provision 2 Private EC2s
private_ec2s = ec2.create_instances(
    ImageId=ubuntu_2604_ami,
    InstanceType='t2.micro',
    MinCount=2, MaxCount=2,
    KeyName=key_name,
    NetworkInterfaces=[{
        'SubnetId': private_subnet.id,
        'DeviceIndex': 0,
        'Groups': [private_sg.group_id]
    }],
    BlockDeviceMappings=block_device_mappings,
    TagSpecifications=[{'ResourceType': 'instance', 'Tags': [{'Key': 'Name', 'Value': 'TM-Backend-01'}]}]
)

print("\n--- Infrastructure Provisioned ---")
print(f"VPC ID: {vpc.id}")
print(f"Public Instance ID: {public_ec2[0].id}")
print(f"Private Instance IDs: {private_ec2s[0].id}, {private_ec2s[1].id}")
print(f"Use '{key_name}.pem' to SSH into the Public Instance.")