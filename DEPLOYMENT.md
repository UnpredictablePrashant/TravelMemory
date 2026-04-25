# TravelMemory — Deployment Steps

This document covers the complete deployment of the TravelMemory MERN app on AWS — from setting up EC2 instances to configuring an Application Load Balancer and connecting a custom domain through Cloudflare.

**Live URL:** [https://travelmemory.jidolabs.com](https://travelmemory.jidolabs.com)

---

## Table of Contents

1. [Project Configuration](#1-project-configuration)
2. [Launching the First EC2 Instance](#2-launching-the-first-ec2-instance)
3. [Connecting via SSH](#3-connecting-via-ssh)
4. [Installing Node.js, nginx, and Git](#4-installing-nodejs-nginx-and-git)
5. [Cloning the Repository and Setting Up the Backend](#5-cloning-the-repository-and-setting-up-the-backend)
6. [Running the Backend with pm2](#6-running-the-backend-with-pm2)
7. [Building and Deploying the Frontend](#7-building-and-deploying-the-frontend)
8. [Configuring nginx as a Reverse Proxy](#8-configuring-nginx-as-a-reverse-proxy)
9. [Creating an AMI and Launching a Second Instance](#9-creating-an-ami-and-launching-a-second-instance)
10. [Setting Up the Target Group and ALB](#10-setting-up-the-target-group-and-alb)
11. [Cloudflare DNS and SSL Setup](#11-cloudflare-dns-and-ssl-setup)
12. [Updating Code After Deployment](#12-updating-code-after-deployment)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Configuration

Before deploying, I set up a centralized config/env structure to manage environment-specific settings:

```
config/                  # Committed to git — no secrets here
  config.js              # Reads process.env + merges with JSON config based on NODE_ENV
  default.json           # Shared defaults (app name, db name)
  dev.json               # Dev URLs (localhost:3000/3001)
  production.json        # Production URLs (travelmemory.jidolabs.com)

env/                     # Gitignored — contains secrets
  .env.dev               # Dev env vars
  .env.production        # Production env vars
```

The `config/` directory holds non-secret settings like URLs and ports — safe to commit. The `env/` directory holds secrets like `MONGO_URI` and is gitignored, so it needs to be created manually on each server.

Both dev and production share the same MongoDB Atlas cluster (`devops-project-1`).

---

## 2. Launching the First EC2 Instance

I launched the first instance in the **ap-south-1** (Mumbai) region:

| Setting | Value |
|---|---|
| Name | `TravelMemory-1` |
| AMI | Ubuntu Server 24.04 LTS (free tier eligible) |
| Instance type | `t2.micro` |
| Key pair | Created a new `.pem` key |
| VPC | Default VPC (`vpc-b96b9cd2` — `172.31.0.0/16`) |
| Subnet | `subnet-ab4904e7` (ap-south-1b) |
| Auto-assign public IP | Enabled |
| Storage | 8 GB gp3 (default) |

For the security group, I created `travelmemory-sg` with these inbound rules:

| Type | Port | Source | Purpose |
|---|---|---|---|
| SSH | 22 | My IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |

Outbound rules: left as default (all traffic allowed).

> **Important:** SSH source should be "My IP", not "Anywhere", to prevent unauthorized access.

---

## 3. Connecting via SSH

```bash
chmod 400 ~/path-to/your-key.pem
ssh -i ~/path-to/your-key.pem ubuntu@<PUBLIC_IP>
```

Used the public IPv4 address from the EC2 console.

---

## 4. Installing Node.js, nginx, and Git

Ran these on the EC2 instance:

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y curl git nginx

# I used Node.js 18 (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # v18.x
npm -v

sudo systemctl start nginx
sudo systemctl enable nginx
```

Visited `http://<PUBLIC_IP>` to confirm the default nginx welcome page was showing.

---

## 5. Cloning the Repository and Setting Up the Backend

```bash
cd /home/ubuntu
git clone -b fix/experience-details-image-styling https://github.com/aniruddhaadak/TravelMemory.git
cd TravelMemory/backend
npm install
```

Since `env/` is gitignored, I created the production env file manually on the server:

```bash
cd /home/ubuntu/TravelMemory
mkdir -p env

cat > env/.env.production << 'EOF'
MONGO_URI=<your-mongodb-atlas-connection-string>
PORT=3001
NODE_ENV=production
REACT_APP_BACKEND_URL=https://travelmemory.jidolabs.com/api
EOF
```

Then copied it so the backend can load it:

```bash
cp env/.env.production backend/.env
```

> **Note on MONGO_URI:** Don't wrap the connection string in quotes — `dotenv` will include the quotes as part of the value and the connection will fail. Also make sure the entire URI is on a single line.

Made sure the EC2 instance's public IP was in the MongoDB Atlas **Network Access → IP Access List** (I used `0.0.0.0/0` for testing).

Tested the backend manually:

```bash
cd backend
node index.js
# Output: Server started at http://localhost:3001
# Ctrl+C to stop
```

---

## 6. Running the Backend with pm2

Installed pm2 globally and started the backend:

```bash
sudo npm install -g pm2

cd /home/ubuntu/TravelMemory/backend
pm2 start index.js --name travelmemory-api
pm2 status
```

Enabled startup on boot:

```bash
pm2 startup systemd
# Ran the command that pm2 printed out
pm2 save
```

Verified:

```bash
curl http://localhost:3001/hello
# Returns: Hello World!
```

Useful pm2 commands for reference:

```bash
pm2 stop travelmemory-api
pm2 restart travelmemory-api
pm2 logs travelmemory-api --lines 50
pm2 monit
pm2 list
```

---

## 7. Building and Deploying the Frontend

```bash
cd /home/ubuntu/TravelMemory/frontend
npm install

# Pull the REACT_APP_* vars from the centralized env file
grep '^REACT_APP_' ../env/.env.production > .env

npm run build
```

> **Note:** `REACT_APP_BACKEND_URL` is baked into the React build at build time. If you change it later, you need to rebuild.

Copied the build output to nginx's web root:

```bash
sudo cp -r build/* /var/www/html/
```

---

## 8. Configuring nginx as a Reverse Proxy

nginx serves the React frontend on `/` and proxies `/api/` requests to the Node.js backend on port 3001.

Created the config:

```bash
sudo nano /etc/nginx/sites-available/travelmemory.conf
```

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

The trailing `/` on both `location /api/` and `proxy_pass` strips the `/api` prefix before forwarding. So `/api/trip` becomes `/trip` when it reaches the backend.

Enabled it and removed the default site:

```bash
sudo ln -sf /etc/nginx/sites-available/travelmemory.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Verified:

```bash
curl http://localhost/api/hello    # Should return: Hello World!
curl -s http://localhost | head -5 # Should show React app HTML
```

Visited `http://<PUBLIC_IP>` in the browser — the TravelMemory app was working.

---

## 9. Creating an AMI and Launching a Second Instance

For the ALB, I needed at least two instances in different availability zones.

### Creating the AMI

1. Selected `TravelMemory-1` in the EC2 console
2. **Actions → Image and templates → Create image**
3. Named it `TravelMemory-AMI`
4. Waited for the AMI status to become `available` (took a few minutes)

### Launching TravelMemory-2

Launched the second instance from the AMI:

| Setting | Value |
|---|---|
| Name | `TravelMemory-2` |
| Instance type | `t2.micro` |
| Key pair | Same key |
| Subnet | `subnet-79c0dc11` (ap-south-1a) — different AZ from instance 1 |
| Security group | Existing `travelmemory-sg` |
| Auto-assign public IP | Enabled |

> **Note:** TravelMemory-1 is in `ap-south-1b`, TravelMemory-2 is in `ap-south-1a` — different AZs for high availability.

SSHed into TravelMemory-2 and verified everything was running (pm2 and nginx came pre-configured from the AMI):

```bash
pm2 status
curl http://localhost/api/hello
```

> **Free tier note:** Two `t2.micro` instances together use ~1,488 hrs/month, which exceeds the 750 hr free tier limit. Stop the second instance when not actively testing.

---

## 10. Setting Up the Target Group and ALB

### Target Group

Created `travelmemory-tg`:

| Setting | Value |
|---|---|
| Target type | Instances |
| Name | `travelmemory-tg` |
| Protocol / Port | HTTP / 80 |
| VPC | Default VPC |
| Health check protocol | HTTP |
| Health check port | **Override: 3001** |
| Health check path | `/hello` |

Registered both `TravelMemory-1` and `TravelMemory-2` as targets.

> **Why health check on port 3001?** Later, when I added nginx `server_name` restrictions to block direct ALB access, the ALB health checks (which don't send a matching Host header) would get a 444 from nginx. Checking port 3001 directly (`/hello` on the Node.js backend) bypasses nginx and works reliably.

### ALB Security Group

Created `travelmemory-alb-sg`:

| Type | Port | Source |
|---|---|---|
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

### Application Load Balancer

Created `travelmemory-alb`:

| Setting | Value |
|---|---|
| Name | `travelmemory-alb` |
| Scheme | Internet-facing |
| IP address type | IPv4 |
| VPC | Default VPC |
| Mappings | ap-south-1a + ap-south-1b |
| Security group | `travelmemory-alb-sg` |
| Listener | HTTP:80 → Forward to `travelmemory-tg` |

### Updating EC2 Security Group

After the ALB was created, I updated `travelmemory-sg` inbound rules so HTTP traffic only comes through the ALB:

| Type | Port | Source |
|---|---|---|
| SSH | 22 | My IP |
| HTTP | 80 | `travelmemory-alb-sg` (the ALB's security group) |

This prevents direct access to the instances — all web traffic must go through the ALB.

### Verifying

Visited the ALB DNS name (`travelmemory-alb-260773301.ap-south-1.elb.amazonaws.com`) in the browser and confirmed the app was loading. The ALB distributes requests across both instances.

---

## 11. Cloudflare DNS and SSL Setup

I wanted the app to be accessible at `travelmemory.jidolabs.com` with HTTPS, without managing any SSL certificates on the server.

### DNS Record

In the Cloudflare dashboard for `jidolabs.com`:

1. **DNS → Records → Add record**

| Field | Value |
|---|---|
| Type | CNAME |
| Name | `travelmemory` |
| Target | `travelmemory-alb-260773301.ap-south-1.elb.amazonaws.com` |
| Proxy status | Proxied (orange cloud) |

> **Note:** Don't include `http://` in the CNAME target — just the hostname.

### SSL/TLS

Set the encryption mode to **Flexible** under **SSL/TLS → Overview**.

This means Cloudflare handles HTTPS for visitors (free certificate) but talks to the ALB over HTTP. No certificates needed on the EC2 instances or ALB.

```
Browser --[HTTPS]--> Cloudflare --[HTTP]--> ALB --[HTTP]--> EC2
```

> **Why not `travel.memory.jidolabs.com`?** I initially tried a two-level subdomain, but Cloudflare's free Universal SSL certificate only covers `*.jidolabs.com` (one level deep). A subdomain like `travel.memory.jidolabs.com` would need an Advanced Certificate. Using `travelmemory.jidolabs.com` (single level) works with the free cert.

### Blocking Direct ALB Access

Updated nginx on both instances to only respond to requests coming through the custom domain:

```nginx
# Reject requests that don't match our domain
server {
    listen 80 default_server;
    server_name _;
    return 444;
}

# TravelMemory app
server {
    listen 80;
    server_name travelmemory.jidolabs.com;

    root /var/www/html;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Rebuilding Frontend with Custom Domain

On both instances, rebuilt the frontend to use the final production URL:

```bash
cd /home/ubuntu/TravelMemory/frontend
echo 'REACT_APP_BACKEND_URL=https://travelmemory.jidolabs.com/api' > .env
npm run build
sudo cp -r build/* /var/www/html/
```

### Final Verification

- `https://travelmemory.jidolabs.com` — app loads with valid SSL padlock
- Raw ALB URL — connection closed (blocked by nginx)
- `https://travelmemory.jidolabs.com/api/trip` — returns trip data

---

## 12. Updating Code After Deployment

When I push code changes, here's how to update both instances:

```bash
cd /home/ubuntu/TravelMemory
git pull origin fix/experience-details-image-styling

# Re-apply env files (env/ is gitignored, so pull won't touch them)
cp env/.env.production backend/.env
grep '^REACT_APP_' env/.env.production > frontend/.env

# Backend
cd backend && npm install && pm2 restart travelmemory-api

# Frontend
cd ../frontend && npm install && npm run build
sudo cp -r build/* /var/www/html/
```

> **Note:** The AMI-based instance (TravelMemory-2) didn't have git installed when I first launched it. Had to install it with `sudo apt install -y git` before pulling.

---

## 13. Troubleshooting

Issues I ran into and how I fixed them:

### MongoDB connection failing

- **Quotes in MONGO_URI:** `dotenv` was parsing the quotes as part of the connection string. Removed quotes from the `.env` file.
- **URI split across lines:** The connection string got split to a new line, causing a "URI cannot contain options with no value" error. Made sure the entire URI is on a single line.
- **IP Access List:** Had to add `0.0.0.0/0` in MongoDB Atlas → Network Access for testing.

### ALB health checks failing

The default nginx server block with `return 444` was rejecting ALB health checks (they don't send the right Host header). Fixed by configuring the target group health check to hit port 3001 directly (`/hello` on the Node.js backend) instead of going through nginx.

### Frontend showing blank page on ALB

The React app was still built with `REACT_APP_BACKEND_URL` pointing to a single instance IP instead of the ALB. Had to rebuild the frontend with the correct ALB URL (and later the Cloudflare domain).

### SSL certificate not covering subdomain

`travel.memory.jidolabs.com` wasn't covered by Cloudflare's free Universal SSL certificate (`*.jidolabs.com` only covers one level). Switched to `travelmemory.jidolabs.com`.

### General debugging commands

```bash
# Backend
pm2 status
pm2 logs travelmemory-api --lines 50
pm2 restart travelmemory-api

# nginx
sudo nginx -t
sudo tail -50 /var/log/nginx/error.log

# Frontend rebuild
cd /home/ubuntu/TravelMemory/frontend
npm run build
sudo cp -r build/* /var/www/html/
```
