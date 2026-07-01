# TravelMemory AWS Deployment Guide (EC2 + Nginx + ALB + Cloudflare)

This guide is written for your assignment in `task.md` and follows AWS deployment best practices for security, scalability, and resilience.

### Assignment deliverables and submission (per `task.md`)

**What you must produce**

1. **Running application** — TravelMemory deployed on EC2, with frontend and backend communicating correctly, scaled behind a load balancer where required, and reachable via your **custom domain** (Cloudflare DNS as specified in the brief).
2. **Documentation** — A **step-by-step** write-up of your deployment with **screenshots** at each major step so someone else can **reproduce** your setup. Use this guide as a technical reference; your submission document should read as *your* run (your IPs, masked secrets, your DNS names), not a generic copy-paste.
3. **Architecture diagram** — A **draw.io** diagram showing users, Cloudflare, ALB, EC2 instances, and MongoDB (and how traffic flows). You may start from `docs/TravelMemory-architecture.drawio` in this repo and export PNG/PDF for your report if your course allows.

**How your work is evaluated (from the brief)**

- Accuracy and effectiveness of the deployment (app works end-to-end through the domain).
- Clarity and completeness of the documentation (steps + screenshots).
- Adherence to best practices for **security** (no secrets in git, least-privilege IAM, locked-down SSH), **scalability** (multiple targets behind the ALB), and **resilience** (health checks, PM2, optional ASG/automation as extras).

**Submission instructions (Vlearn)**

1. Confirm the assignment is **fully completed** (backend, Nginx reverse proxy, frontend/backend URL configuration, multiple instances + ALB, Cloudflare CNAME/A as required).
2. **Push your code** to a **GitHub repository** you control (fork of the [upstream project](https://github.com/UnpredictablePrashant/TravelMemory) or your own repo). Do **not** commit private keys (e.g. `.pem`), real `.env` files, or live database passwords.
3. Prepare a **single file** in one of these formats: **plain text (`.txt`)**, **Word (`.docx`)**, or **PDF** — the file should prominently include the **HTTPS link to your GitHub repository** (and any other identifiers your instructor requested, e.g. name or batch).
4. **Submit that file** through **Vlearn** as your course directs.

The [screenshot checklist](#12-screenshot-checklist-for-submission) below lists captures that support both the brief’s documentation requirement and a strong submission package.

**Mapping: `task.md` tasks → sections of this guide**

| Task in brief | Where this guide covers it |
| --- | --- |
| Backend on Node, Nginx reverse proxy, `.env` for DB and port | [§5 Server setup](#5-server-setup-on-each-ec2-instance), [§6.1 Backend](#61-backend-setup), [§7 Nginx](#7-configure-nginx-reverse-proxy) |
| Frontend talks to backend (`urls.js` in brief; this repo uses `url.js`) | [§6.2 Frontend](#62-frontend-setup) |
| Multiple instances + load balancer | [§4 EC2](#4-ec2-instances-create-only-if-you-do-not-already-have-them), [§8 ALB](#8-create-application-load-balancer-alb) |
| Cloudflare: CNAME to ALB, A record to EC2 | [§9 Cloudflare](#9-domain-setup-in-cloudflare) |
| Documentation + screenshots + draw.io diagram | This section, [§12 Screenshots](#12-screenshot-checklist-for-submission), [§13 Diagram](#13-drawio-architecture-diagram-what-to-include) |

## 1) Target Architecture

- Users access `travel.yourdomain.com` through Cloudflare.
- Cloudflare points to an AWS Application Load Balancer (ALB).
- ALB routes traffic to multiple EC2 instances (each instance serves frontend with Nginx and proxies API requests to backend Node.js app running on `localhost:3000`).
- Backend instances connect to MongoDB Atlas.
- PM2 keeps the backend process alive.

## 2) Prerequisites

- AWS account with access to EC2, ALB, IAM, and CloudWatch.
- Domain added to Cloudflare.
- SSH key pair (`.pem`) for EC2 login.
- MongoDB Atlas connection string.
- GitHub account to **host your completed code** (fork or new repo) for submission.
- **Vlearn** access to upload the submission file (`.txt`, `.docx`, or `.pdf`) that contains your repository link.

## 3) AWS Security Baseline (Recommended)

1. Use an IAM user/role with least privilege (avoid using root account).
2. Enable MFA on AWS account/users.
3. Create a Security Group:
   - Inbound:
     - `22` (SSH) -> only your IP
     - `80` (HTTP) -> `0.0.0.0/0`
     - `443` (HTTPS) -> `0.0.0.0/0` (if SSL termination is configured)
   - Outbound:
     - Allow all (default) or restrict as required.
4. Keep app secrets in environment variables (`.env`) and never commit them.
5. Install security updates on EC2 before deployment.

## 4) EC2 Instances (create only if you do not already have them)

**If you already have suitable EC2 instances** (same OS/stack, correct security group, key pair): do **not** launch new ones. Skip to [section 5 (Server Setup)](#5-server-setup-on-each-ec2-instance) on each instance, and only adjust configuration (Nginx, app, PM2, env) where something is missing or wrong.

Create new instances **only when** you need additional capacity or you have none yet. You need at least **2 instances** for the load-balancing part of the assignment:

- AMI: Ubuntu 22.04 LTS
- Instance type: `t2.micro` (or as required)
- Attach the Security Group from above
- Attach your key pair

Optional production recommendation:
- Use an Auto Scaling Group with Launch Template instead of manually creating instances.

## 5) Server Setup on Each EC2 Instance

SSH into each instance:

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Node.js: what to use?

| Approach | When to use |
| -------- | ----------- |
| **NodeSource** (`setup_XX.x` script + `apt install nodejs`) | **Recommended on EC2.** One system-wide Node version; `pm2` and `pm2 startup` work without shell tricks. The guide and `automation/ec2_initial_setup.sh` use this (default **20** LTS; override with `NODE_MAJOR=18`). |
| **Ubuntu repo `nodejs` only** | **Often too old** on Ubuntu 22.04; only consider if `apt show nodejs` is new enough for your stack. |
| **nvm** | Best when you **switch Node versions often** (multiple projects). On a server, install deps with the same Node you run (`nvm use && npm ci`), install PM2 after that (`npm i -g pm2`), and run `pm2 startup` from that environment so paths stay consistent. Slightly more moving parts than NodeSource. |

### Quick install (script)

From the repo on the instance (clone first, or copy the script over):

```bash
cd ~/TravelMemory   # or your clone path
chmod +x automation/ec2_initial_setup.sh
./automation/ec2_initial_setup.sh
```

Use Node 18 instead of 20:

```bash
NODE_MAJOR=18 ./automation/ec2_initial_setup.sh
```

### Manual install (same result as the script)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v && npm -v
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 6) Clone and Configure Project

### Git on EC2 (clone from GitHub)

1. **Install Git** (included if you ran `automation/ec2_initial_setup.sh`; otherwise `sudo apt install -y git`).

2. **Public repository** — no GitHub account needed on the server:

   ```bash
   git clone https://github.com/UnpredictablePrashant/TravelMemory.git
   cd TravelMemory
   ```

3. **Optional identity** (only matters if you will `git commit` on the server):

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

4. **Private repository** — pick one:

   - **HTTPS + Personal Access Token (simple):**  
     On GitHub: **Settings → Developer settings → Personal access tokens** — create a token with `repo` scope. Clone with:
     ```bash
     git clone https://github.com/YOUR_USER/YOUR_REPO.git
     ```
     When prompted for password, paste the **token** (not your GitHub password).

   - **SSH key (no token in URLs):**  
     On the EC2 instance:
     ```bash
     ssh-keygen -t ed25519 -C "ec2-travelmemory" -f ~/.ssh/id_ed25519 -N ""
     cat ~/.ssh/id_ed25519.pub
     ```
     Copy the line and add it in GitHub: **Settings → SSH and GPG keys → New SSH key**.  
     Test: `ssh -T git@github.com` (type `yes` if asked). Then clone:
     ```bash
     git clone git@github.com:YOUR_USER/YOUR_REPO.git
     ```

### 6.1 Backend setup

```bash
cd backend
npm install
cp .env.example .env 2>/dev/null || touch .env
```

Set `backend/.env` values:

```env
MONGO_URI=<your_mongodb_atlas_uri>
PORT=3000
```

Start backend with PM2:

```bash
pm2 start index.js --name travelmemory-backend
pm2 save
pm2 startup
```

### 6.2 Frontend setup

The assignment mentions `urls.js`, but in this repository the correct file is:

- `frontend/src/url.js`

Go to frontend and install:

```bash
cd ../frontend
npm install
```

Create frontend env:

```bash
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=/api
EOF
```

Why `/api`?
- Nginx will proxy `/api` requests to `http://127.0.0.1:3000`, so frontend and backend work through one domain cleanly.

Build frontend:

```bash
npm run build
```

## 7) Configure Nginx Reverse Proxy

Use the **canonical config** in the repo (recommended — easier to diff and fix than a one-off paste):

```bash
sudo cp ~/TravelMemory/automation/nginx-travelmemory.conf /etc/nginx/sites-available/travelmemory
# If your project path is not ~/TravelMemory, edit root in that file first:
#   sudo nano /etc/nginx/sites-available/travelmemory
```

**Rules that must be correct:**

| Piece | Why |
| ----- | --- |
| `root` | Must point to **`frontend/build`** after `npm run build`. Wrong path → 404/500. |
| `location /api/` + `proxy_pass http://127.0.0.1:3000/;` | **Both** need trailing slashes so `/api/trip/` becomes **`/trip/`** on Node (Express uses `/trip`, not `/api/trip`). |
| `try_files … /index.html` | SPA fallback so React Router works. |
| `sites-enabled/default` removed | Otherwise the default site may answer on port 80 instead of your app. |
| Backend on **`3000`** | `backend/.env` → `PORT=3000`, `pm2` running `index.js`. |

Enable config and reload Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/travelmemory /etc/nginx/sites-enabled/travelmemory
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Test instance locally:

```bash
curl http://localhost
curl http://localhost/api/trip/
```

If **`curl http://127.0.0.1/` returns `500`** or Nginx’s error log shows **`stat() ".../frontend/build/index.html" failed (13: Permission denied)`** and **“internal redirection cycle while internally redirecting to `/index.html`”**, Nginx (`www-data`) cannot read your home directory or `frontend/build`. Fix on the instance:

```bash
chmod +x ~/TravelMemory/automation/fix_nginx_build_permissions.sh
~/TravelMemory/automation/fix_nginx_build_permissions.sh
sudo systemctl reload nginx
```

Or manually (adjust paths if your clone is not under `/home/ubuntu/TravelMemory`):

```bash
chmod 755 /home/ubuntu
chmod 755 /home/ubuntu/TravelMemory /home/ubuntu/TravelMemory/frontend
chmod -R o+rX /home/ubuntu/TravelMemory/frontend/build
sudo systemctl reload nginx
```

Then verify: `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/` should print **`200`**. If not: `sudo tail -30 /var/log/nginx/error.log`.

## 8) Create Application Load Balancer (ALB)

1. Go to EC2 -> Target Groups.
2. Create target group:
   - Type: `Instances`
   - Protocol: HTTP
   - Port: `80`
   - Health check path: `/`
3. Register all TravelMemory EC2 instances in this target group.
4. Go to EC2 -> Load Balancers -> Create ALB:
   - Internet-facing
   - Attach at least 2 Availability Zones
   - Listener: HTTP:80 (or HTTPS:443 if ACM cert configured)
   - Forward to the target group created above.
5. Verify target health = `healthy`.

## 9) Domain Setup in Cloudflare

In Cloudflare DNS:

1. `CNAME` record:
   - Name: `travel` (or `www`)
   - Target: `<your-alb-dns-name>`
   - Proxy status: proxied (orange cloud) if desired
2. `A` record (as requested in assignment):
   - Name: `origin` (or any label)
   - IPv4 address: `<frontend_ec2_public_ip>`
   - Use this mainly for direct-origin testing.

Example:
- `travel.yourdomain.com` -> CNAME -> ALB DNS
- `origin.yourdomain.com` -> A -> EC2 public IP

## 10) Verification Checklist

- `http://travel.yourdomain.com` opens frontend.
- Frontend CRUD actions successfully hit backend API.
- ALB target group shows all instances healthy.
- Stop backend on one instance; app should still respond through other healthy instance(s).
- `pm2 list` shows backend process online.
- `sudo systemctl status nginx` shows active.

## 11) Observability and Reliability (Best Practice Add-ons)

- Enable ALB access logs to S3.
- Install CloudWatch Agent for CPU, memory, disk monitoring.
- Create CloudWatch alarms for:
  - EC2 CPU high
  - Unhealthy host count in ALB target group
- Use Auto Scaling Group to automatically replace failed instances.
- Enable HTTPS:
  - Issue certificate in AWS ACM
  - Add HTTPS listener on ALB
  - Redirect HTTP to HTTPS

## 12) Screenshot Checklist for Submission

The assignment asks for **comprehensive** documentation with **screenshots** so the process is **clear and reproducible**. Capture the following for your report (and keep a copy of the narrative steps alongside these images). Together with your **Vlearn submission file** (text/Word/PDF containing your **GitHub repo link**), this satisfies the brief’s documentation and evidence expectations.

1. EC2 instances list (multiple running instances).
2. Security Group inbound rules.
3. Backend `.env` (mask secrets).
4. `frontend/src/url.js` and frontend `.env` (the brief names `urls.js`; in this codebase the file is `url.js`).
5. PM2 process list.
6. Nginx config + successful `nginx -t`.
7. ALB details (DNS name + listeners).
8. Target Group healthy instances.
9. Cloudflare DNS records (CNAME to load balancer + A record to EC2 as required).
10. Final app running from custom domain (browser URL bar visible).

## 13) draw.io Architecture Diagram (What to Include)

The brief requires a deployment architecture diagram in **[draw.io](https://app.diagrams.net/)**. Export it as PNG or PDF for your written submission if required. Optional starter: open `docs/TravelMemory-architecture.drawio` from this repository in draw.io and extend it with your actual resource names and regions.

Include these components and arrows:

1. User Browser
2. Cloudflare (DNS/Proxy)
3. AWS ALB
4. EC2 Instance A (Nginx + React build + Node backend via PM2)
5. EC2 Instance B (same stack)
6. MongoDB Atlas

Flow:
- Browser -> Cloudflare -> ALB -> EC2 instances
- Nginx (`/api`) -> Node backend (`localhost:3000`) -> MongoDB Atlas

## 14) Common Troubleshooting

- **Cannot SSH to EC2 (`Connection timed out` / refused):**
  - **Security group:** The instance must allow **inbound TCP 22** from your IP (or `0.0.0.0/0` only while learning). If the VM still uses **`default`** or another group from the launch wizard, it may have **no SSH rule**. Attach the same group you defined for TravelMemory (in automation, `security_group.name`, e.g. `travelmemory-app-sg` after `aws_setup.py` created it in that VPC).
  - **Same VPC:** The security group from `aws_setup.py` lives in **one VPC**. The instance must be in that VPC, or you must add inbound rules on whichever group the instance actually uses.
  - **Automation:** From the repo, after `ec2.instance_ids` are set and the app SG exists in that VPC, run:
    ```bash
    python3 automation/attach_ec2_security_group.py --config automation/config.yaml
    ```
    Use `--dry-run` first to see planned changes. This **replaces** the instance’s security groups with **only** the configured app group (SSH + HTTP + HTTPS per your YAML).
  - **Public reachability:** Use a **public subnet**, a route to an **Internet Gateway**, and a **public IPv4 address** (or Elastic IP) on the instance. Private subnets need a bastion or Session Manager.
  - **User and key:** Ubuntu AMIs use user `ubuntu`. Use the **`.pem`** that matches the instance key pair: `ssh -i your-key.pem ubuntu@<public_ip>`.
- **Browser cannot open `http://<instance-ip>` (timeout or “site can’t be reached”):**
  - **Use the public address:** In EC2 → Instances → your instance, copy **Public IPv4 address** (not **Private IPv4**). Test with `curl -v http://THAT_IP` from your laptop.
  - **Security group:** Inbound **TCP 80** (HTTP) from **`0.0.0.0/0`** (or your IP) on **every security group** attached to the instance. If you only opened port 22, HTTP will time out. Add the same rule for **443** if you use HTTPS directly on the instance.
  - **Subnet / routing:** The instance must be in a **public subnet** (route table: `0.0.0.0/0` → **Internet Gateway**). A private subnet with no load balancer in front has no path from the internet to Nginx on port 80.
  - **Public IP:** Auto-assign public IP must be on, or attach an **Elastic IP**. Stopped/started instances can lose a non-Elastic public IP depending on settings—confirm the IP you use is current.
  - **On the instance (SSH):** `sudo systemctl status nginx` (active), `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1` (expect `200` for default welcome or your app). If **UFW** is enabled: `sudo ufw allow 'Nginx Full'` or `sudo ufw allow 80/tcp` then `sudo ufw reload`.
  - **Nginx listening:** `ss -tlnp | grep ':80'` should show nginx. If you replaced the default site, run `sudo nginx -t` and fix config errors.
- `502 Bad Gateway`:
  - Backend not running (`pm2 list`)
  - Wrong Nginx `proxy_pass`
- Frontend loads but API fails:
  - Check frontend `.env` and rebuild (`npm run build`)
  - Confirm `REACT_APP_BACKEND_URL=/api`
- ALB health checks failing:
  - Ensure Nginx serves `/` on port `80`
  - Check Security Group allows ALB -> instance traffic
- CORS errors:
  - Prefer same-domain `/api` proxy setup shown above.

## 15) One-Time AWS Automation (boto3 + external config)

If you want to create most AWS resources in one run, use:

- Script: `automation/aws_setup.py`
- Config template: `automation/config.example.yaml`

**EC2 behavior (pick one):**

- **Existing instances:** Set real IDs in `ec2.instance_ids` and leave `ec2.launch.enabled: false`. The script does **not** launch new VMs; it wires the load-balancer stack and registers those instances.
- **End-to-end (no instances yet):** Clear placeholders from `ec2.instance_ids` (or use an empty list), set `ec2.launch.enabled: true`, and set `ec2.launch.key_name` to an EC2 key pair in that region. The script creates up to `ec2.launch.count` Ubuntu 22.04 instances (spread across subnets), tagged `Name` plus your `project.tag_key` / `project.tag_value` (see below). If matching tagged instances from a previous run already exist, it **reuses** them instead of creating duplicates.

ALB, target group, security group, and listener are still created or reused by name as before.

### 15.1 Prepare config file

```bash
cp automation/config.example.yaml automation/config.yaml
```

Update `automation/config.yaml`:

- `aws_profile`, `aws_region`
- `project.tag_key` and `project.tag_value` (for example `Project` / `travelmemory16`): applied to the security group, ALB, target group, and every app EC2 instance after each `aws_setup.py` run so you can filter resources in the console or with `python automation/list_project_resources.py`
- **Either** `ec2.instance_ids` (existing app instances) **or** `ec2.launch.enabled: true` with `ec2.launch.key_name` (and optional `count`, `instance_type`, `ami_id`)
- Optional `network.vpc_id` and `network.subnet_ids` (leave blank to auto-detect default VPC/subnets)
- `cloudflare.domain` and `cloudflare.subdomain`
- `backend.mongo_uri` (for your own reference)

### 15.2 Install Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r automation/requirements.txt
```

### 15.3 Run the one-time setup

```bash
python automation/aws_setup.py --config automation/config.yaml
```

This creates or reuses:

- Security Group
- Target Group
- Application Load Balancer
- Listener
- EC2 instances **only if** `ec2.launch.enabled` is true and you did not supply real `ec2.instance_ids`
- Target registration for the resolved EC2 instances
- The project tag on the security group, ALB, target group, and all registered EC2 instances (merged if the tag already exists)

Outputs are saved in:

- `automation/output/deployment-outputs.json`

Use `load_balancer_dns` from that output in Cloudflare CNAME. The file also includes `ec2_instance_ids` and, when instances were created or matched by launch tags, a short `config_followup` note: copy those IDs into `ec2.instance_ids`, set `ec2.launch.enabled: false`, then continue with server setup (Nginx, app) on each instance—**the script does not install software on the VMs.**

### 15.4 Cloudflare if domain is not purchased yet

You can complete AWS setup first and postpone DNS cutover.
When your domain is ready:

1. Create CNAME:
   - `<subdomain>.<domain>` -> `<load_balancer_dns>`
2. (Assignment requirement) add an A record pointing to one EC2 public IP for origin testing.

## 16) Cost Control Scripts (Start/Stop + Auto-stop after 15 minutes idle)

These are separate scripts in `automation/`:

- `start_instances.py` -> starts app EC2 instances
- `stop_instances.py` -> stops app EC2 instances
- `auto_stop_after_idle.py` -> checks ALB traffic and stops running instances if idle

### 16.1 Start instances on demand

```bash
python automation/start_instances.py --config automation/config.yaml --wait
```

Use this before accessing your domain when instances are currently stopped.

### 16.2 Stop all instances manually

```bash
python automation/stop_instances.py --config automation/config.yaml --wait
```

### 16.3 Auto-stop after 15 minutes no traffic

Config values (`automation/config.yaml`):

```yaml
cost_control:
  auto_stop_idle_minutes: 15
  request_threshold: 0
```

Run check manually:

```bash
python automation/auto_stop_after_idle.py --config automation/config.yaml
```

Set cron to run every 5 minutes:

```bash
crontab -e
```

Add:

```cron
*/5 * * * * /usr/bin/python3 /home/ubuntu/TravelMemory/automation/auto_stop_after_idle.py --config /home/ubuntu/TravelMemory/automation/config.yaml >> /home/ubuntu/TravelMemory/automation/output/auto-stop.log 2>&1
```

Important:
- If all EC2 instances are stopped, your domain will not automatically "wake" them by itself.
- Start script must be executed first (manually or via your own trigger automation).
- ALB and other AWS resources can still incur cost even when EC2 instances are stopped.

## 17) Stop Other Chargeable Resources

To control costs beyond EC2, use:

- `automation/stop_chargeable_resources.py`

### 17.1 Safe mode (stop EC2 only)

```bash
python automation/stop_chargeable_resources.py --config automation/config.yaml --wait
```

### 17.2 Maximum cost-cut mode (destructive)

This mode:
- stops EC2 instances
- deletes ALB + listeners
- deletes target group
- attempts to delete security group created for this project
- optionally releases unattached Elastic IPs

```bash
python automation/stop_chargeable_resources.py --config automation/config.yaml --wait --delete-alb-stack --release-unattached-eips --yes
```

Important notes:
- With ALB deleted, your domain CNAME target no longer works until you recreate resources.
- To bring setup back: run `python automation/aws_setup.py --config automation/config.yaml`
- If SG deletion fails, it usually means another resource still references it.

### 17.3 Typical low-cost workflow

1. Keep app off most of the time:
   - `stop_chargeable_resources.py` with ALB stack deletion
2. When you need demo/access:
   - `aws_setup.py` to recreate ALB stack (if deleted)
   - `start_instances.py` to power on EC2
3. Enable 15-min idle guard:
   - run `auto_stop_after_idle.py` via cron

