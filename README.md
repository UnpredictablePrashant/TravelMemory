# Travel Memory

A small full-stack app to record travel experiences: **React** frontend, **Express** + **Mongoose** backend, and **MongoDB**.

## Prerequisites

- Node.js 20+ (for local development)
- MongoDB (local or Atlas) if you run the stack without Docker
- [Docker](https://docs.docker.com/get-docker/) if you use the container workflow below

## Local development

### Backend

Create `backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/travelmemory
PORT=3001
```

From `backend/`:

```bash
npm install
npm start
```

The API listens on `http://localhost:3001` (for example `GET /trip`, `POST /trip`).

### Frontend

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:3001
```

From `frontend/`:

```bash
npm install
npm start
```

The dev server runs on port **3000** by default.

## Docker (no Compose)

Images and a shared user-defined network are wired with plain `docker` commands. Scripts build the images, attach MongoDB with a **persistent named volume**, and start backend and frontend.

### Quick start

From the repository root:

```bash
./scripts/docker-up.sh
```

- **Frontend:** http://localhost:3000 (nginx serving the production build)
- **Backend:** http://localhost:3001
- **MongoDB:** reachable only inside the Docker network; data is stored in volume `travelmemory-mongo-data` (override with `MONGO_VOLUME`)

Stop containers (data volume is kept):

```bash
./scripts/docker-down.sh
```

Optional flags (can be combined in any order):

- `--remove-network` — remove the `travelmemory-net` bridge network
- `--remove-volume` — remove the MongoDB data volume after the container is gone

### Manual builds (reference)

```bash
docker network create travelmemory-net

docker build -t travelmemory-backend ./backend
docker build -t travelmemory-frontend ./frontend \
  --build-arg REACT_APP_BACKEND_URL=http://localhost:3001

docker volume create travelmemory-mongo-data

docker run -d --name travel-mongo --network travelmemory-net \
  -v travelmemory-mongo-data:/data/db mongo:7

docker run -d --name travel-backend --network travelmemory-net -p 3001:3001 \
  -e PORT=3001 \
  -e MONGO_URI=mongodb://travel-mongo:27017/travelmemory \
  travelmemory-backend

docker run -d --name travel-frontend --network travelmemory-net -p 3000:80 \
  travelmemory-frontend
```

### Environment variables (scripts)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NETWORK` | `travelmemory-net` | Docker bridge network name |
| `MONGO_NAME` | `travel-mongo` | MongoDB container name |
| `BACKEND_NAME` | `travel-backend` | Backend container name |
| `FRONTEND_NAME` | `travel-frontend` | Frontend container name |
| `MONGO_VOLUME` | `travelmemory-mongo-data` | Named volume (or host path for a bind mount) for `/data/db` |
| `MONGO_URI` | `mongodb://travel-mongo:27017/travelmemory` | Passed to the backend |
| `REACT_APP_BACKEND_URL` | `http://localhost:3001` | Baked into the frontend build (`docker build` arg) |

## Sample trip payload

```json
{
  "tripName": "Incredible India",
  "startDateOfJourney": "19-03-2022",
  "endDateOfJourney": "27-03-2022",
  "nameOfHotels": "Hotel Namaste, Backpackers Club",
  "placesVisited": "Delhi, Kolkata, Chennai, Mumbai",
  "totalCost": 800000,
  "tripType": "leisure",
  "experience": "Lorem ipsum…",
  "image": "https://example.com/image.jpg",
  "shortDescription": "India is a wonderful country with rich culture and good people.",
  "featured": true
}
```
