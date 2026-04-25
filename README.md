# TravelMemory

A full-stack MERN web application for documenting and browsing travel experiences. Deployed on AWS with load balancing and Cloudflare DNS.

**Live URL:** [https://travelmemory.jidolabs.com](https://travelmemory.jidolabs.com)

---

## Tech Stack

- **Frontend:** React 18, React Router v6, Axios, Bootstrap 5 (CDN)
- **Backend:** Node.js, Express 4, Mongoose 7
- **Database:** MongoDB Atlas
- **Deployment:** AWS EC2, ALB, pm2, nginx, Cloudflare

---

## Project Structure

```
TravelMemory/
├── backend/              # Express API server
│   ├── index.js          # Entry point
│   ├── conn.js           # MongoDB connection
│   ├── models/           # Mongoose schemas
│   ├── controllers/      # Route handlers
│   └── routes/           # API routes
├── frontend/             # React app (Create React App)
│   └── src/
│       ├── App.js        # Router setup
│       ├── url.js        # API base URL config
│       └── components/   # Pages and UI components
├── config/               # Environment-specific config (committed)
│   ├── config.js         # Reads process.env + merges JSON config
│   ├── default.json      # Shared defaults
│   ├── dev.json          # Dev URLs (localhost)
│   └── production.json   # Production URLs
├── env/                  # Environment variables (gitignored)
│   ├── .env.dev          # Dev secrets
│   └── .env.production   # Production secrets
└── DEPLOYMENT.md         # Detailed deployment guide
```

---

## Local Development

### Backend

```bash
cd backend && npm install

# Create .env file
echo 'MONGO_URI=<your-mongodb-connection-string>
PORT=3001' > .env

npx nodemon index.js    # Starts on http://localhost:3001
```

### Frontend

```bash
cd frontend && npm install

# Create .env file
echo 'REACT_APP_BACKEND_URL=http://localhost:3001' > .env

npm start               # Starts on http://localhost:3000
```

### Sample Trip Data

```json
{
  "tripName": "Tokyo Cherry Blossom Adventure",
  "startDateOfJourney": "2026-03-25",
  "endDateOfJourney": "2026-04-02",
  "nameOfHotels": "Park Hyatt Tokyo, Hoshinoya Kyoto",
  "placesVisited": "Tokyo, Kyoto, Osaka, Nara",
  "totalCost": 150000,
  "tripType": "leisure",
  "experience": "Witnessed the magical cherry blossom season in Japan.",
  "image": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
  "shortDescription": "A spring trip through Japan chasing cherry blossoms",
  "featured": true
}
```

---

## AWS Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTERNET                                         │
│                                                                             │
│   ┌───────────┐    HTTPS    ┌──────────────────────────────────────┐        │
│   │  Users /  │ ──────────► │         CLOUDFLARE                   │        │
│   │  Browser  │             │  Domain: travelmemory.jidolabs.com   │        │
│   └───────────┘             │  SSL/TLS: Flexible (free cert)       │        │
│                             │  Proxy: Enabled (orange cloud)       │        │
│                             │  CNAME → ALB DNS                     │        │
│                             └──────────────┬───────────────────────┘        │
│                                            │ HTTP                           │
└────────────────────────────────────────────┼────────────────────────────────┘
                                             │
┌────────────────────────────────────────────┼────────────────────────────────┐
│  AWS VPC (vpc-b96b9cd2 — 172.31.0.0/16)   │       Region: ap-south-1      │
│                                            │                                │
│  ┌─────────────────────────────────────────┼──────────────────────────┐     │
│  │              travelmemory-alb-sg        │                          │     │
│  │              Inbound: HTTP 80, HTTPS 443 from 0.0.0.0/0          │     │
│  │                                         │                          │     │
│  │         ┌───────────────────────────────┴──────────────────┐       │     │
│  │         │        APPLICATION LOAD BALANCER (ALB)           │       │     │
│  │         │        travelmemory-alb                          │       │     │
│  │         │        Listener: HTTP:80 → travelmemory-tg       │       │     │
│  │         │        Scheme: Internet-facing                   │       │     │
│  │         └───────────────┬──────────────────┬───────────────┘       │     │
│  └─────────────────────────┼──────────────────┼───────────────────────┘     │
│                            │                  │                              │
│  ┌─────────────────────────┼──────────────────┼───────────────────────┐     │
│  │              travelmemory-sg               │                       │     │
│  │              Inbound: SSH 22 (My IP), HTTP 80 (from ALB SG only)  │     │
│  │                         │                  │                       │     │
│  │    ┌────────────────────┴───┐  ┌───────────┴────────────────┐     │     │
│  │    │  AZ: ap-south-1b      │  │  AZ: ap-south-1a           │     │     │
│  │    │  subnet-ab4904e7      │  │  subnet-79c0dc11           │     │     │
│  │    │                       │  │                             │     │     │
│  │    │  ┌─────────────────┐  │  │  ┌─────────────────┐       │     │     │
│  │    │  │ TravelMemory-1  │  │  │  │ TravelMemory-2  │       │     │     │
│  │    │  │ t2.micro        │  │  │  │ t2.micro (AMI)  │       │     │     │
│  │    │  │                 │  │  │  │                  │       │     │     │
│  │    │  │ nginx (:80)     │  │  │  │ nginx (:80)     │       │     │     │
│  │    │  │   ├─ / → React  │  │  │  │   ├─ / → React  │       │     │     │
│  │    │  │   └─ /api → :3001│  │  │  │   └─ /api → :3001│     │     │     │
│  │    │  │                 │  │  │  │                  │       │     │     │
│  │    │  │ pm2 → node:3001 │  │  │  │ pm2 → node:3001 │       │     │     │
│  │    │  │ (Express API)   │  │  │  │ (Express API)   │       │     │     │
│  │    │  └─────────────────┘  │  │  └─────────────────┘       │     │     │
│  │    └───────────────────────┘  └─────────────────────────────┘     │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                  TARGET GROUP: travelmemory-tg                    │       │
│  │                  Health check: GET /hello on port 3001            │       │
│  │                  Targets: TravelMemory-1, TravelMemory-2          │       │
│  │                  Status: Healthy                                  │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             │ MongoDB connection
                                             ▼
                              ┌───────────────────────────┐
                              │      MONGODB ATLAS         │
                              │      (External)            │
                              │      IP Access: 0.0.0.0/0  │
                              │      Cluster: devops-       │
                              │        project-1            │
                              └───────────────────────────┘
```

### Traffic Flow

```
1. User visits https://travelmemory.jidolabs.com
2. Cloudflare terminates HTTPS (free SSL cert), proxies via HTTP to ALB
3. ALB distributes traffic across EC2 instances (round-robin)
4. nginx on EC2 routes:
   - /api/* → Node.js backend on port 3001
   - /*     → React static files from /var/www/html
5. Backend connects to MongoDB Atlas for data
```

---

## Deployment Overview

| Step | What | Key Details |
|------|------|-------------|
| 1 | **EC2 Instance** | Ubuntu 24.04 LTS, `t2.micro`, Node.js 18, nginx, pm2 |
| 2 | **Security Groups** | `travelmemory-sg` (SSH: My IP, HTTP: ALB only), `travelmemory-alb-sg` (HTTP/HTTPS: open) |
| 3 | **AMI** | Created from configured instance, launched 2nd instance in a different AZ |
| 4 | **Target Group** | `travelmemory-tg`, health check `GET /hello` on port 3001, both targets healthy |
| 5 | **ALB** | `travelmemory-alb`, internet-facing, HTTP:80 → target group, spans `ap-south-1a` + `ap-south-1b` |
| 6 | **Cloudflare DNS** | CNAME `travelmemory` → ALB DNS, proxied (orange cloud) |
| 7 | **SSL/TLS** | Cloudflare Flexible mode — free HTTPS, no certs on server |
| 8 | **nginx** | Reverse proxy: `/api/` → Node.js :3001, `/` → React build, rejects direct ALB access |

For the full step-by-step guide with commands, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/trip` | Get all trips |
| GET | `/trip/:id` | Get trip by ID |
| POST | `/trip` | Add a new trip |
