#!/usr/bin/env bash
# Initial packages for TravelMemory on Ubuntu 22.04/24.04 EC2.
# Run after SSH:  bash automation/ec2_initial_setup.sh
# Or from repo root on the instance after cloning.
#
# Node: installs NodeSource LTS line (default major 20). Override:
#   NODE_MAJOR=18 bash automation/ec2_initial_setup.sh

set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo "Run as normal user (e.g. ubuntu); the script will use sudo where needed." >&2
  exit 1
fi

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y nginx git curl ca-certificates gnupg

# Node.js LTS via NodeSource (predictable version for servers; works well with PM2).
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
sudo apt-get install -y nodejs

sudo npm install -g pm2

sudo systemctl enable nginx
sudo systemctl start nginx

echo "Versions:"
node -v
npm -v
command -v pm2 >/dev/null && pm2 -v

echo "Done. Next: clone the app, configure backend/.env and frontend, build, then Nginx (see docs/AWS_DEPLOYMENT_GUIDE.md)."
