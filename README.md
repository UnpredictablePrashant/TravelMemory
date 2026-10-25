# Travel Memory

`.env` file to work with the backend after creating a database in mongodb (see `backend/.env.example`):

```
MONGO_URI='ENTER_YOUR_URL'
PORT=3001
# Frontend origins allowed to call the API (comma separated)
CORS_ORIGIN=http://localhost:3000
# Optional
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=5
TRUST_PROXY=0
```

Data format to be added (dates are `YYYY-MM-DD`):

```json
{
    "tripName": "Incredible India",
    "startDateOfJourney": "2022-03-19",
    "endDateOfJourney": "2022-03-27",
    "nameOfHotels":"Hotel Namaste, Backpackers Club",
    "placesVisited":"Delhi, Kolkata, Chennai, Mumbai",
    "totalCost": 800000,
    "tripType": "leisure",
    "experience": "Lorem Ipsum, Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum,Lorem Ipsum, ",
    "image": "https://t3.ftcdn.net/jpg/03/04/85/26/360_F_304852693_nSOn9KvUgafgvZ6wM0CNaULYUa7xXBkA.jpg",
    "shortDescription":"India is a wonderful country with rich culture and good people.",
    "featured": true
}
```


For frontend, you need to create `.env` file and put the following content (remember to change it based on your requirements):
```bash
REACT_APP_BACKEND_URL=http://localhost:3001
```

## How to run BE

Note: Make sure you have the .env file already added
```bash
cd backend
npm install
npm start        # or: npm run dev (auto-reload with nodemon)
```

## How to run FE
Note: Make sure you have the .env file already added
```bash
cd frontend
npm install
npm start
```

## API

| Method | Path          | Description |
|--------|---------------|-------------|
| GET    | `/trip`       | List trips (featured first, newest first). Optional `?featured=true\|false`. The `experience` text is left out of the list. |
| GET    | `/trip/:id`   | Get one trip. `400` for a malformed id, `404` if it does not exist. |
| POST   | `/trip`       | Create a trip. Send JSON, or `multipart/form-data` with an optional `image` file. Returns `201` with `{ message, trip }`. |
| GET    | `/uploads/:file` | Uploaded images. |
| GET    | `/health`     | `200` when the API and database are up, `503` otherwise. |

Errors are always JSON: `{ "error": "message", "details": { "field": "reason" } }`.

Example upload:

```bash
curl -F tripName="Kyoto" -F startDateOfJourney=2024-11-02 -F endDateOfJourney=2024-11-09 \
     -F shortDescription="Temples and maple leaves" -F tripType=backpacking \
     -F image=@photo.jpg http://localhost:3001/trip
```

### Upload rules
- JPEG, PNG, GIF or WEBP only (SVG is rejected). The real file signature is checked, not only the extension/MIME type.
- Max size `MAX_UPLOAD_MB` (default 5 MB), one file per request.
- Files get a random name and are served with `X-Content-Type-Options: nosniff`.

### Security measures
- `helmet` security headers, CORS limited to `CORS_ORIGIN`, rate limiting (stricter on `POST /trip`), 100kb JSON body limit.
- Input allow-listing and validation (lengths, dates, trip type, cost, http(s)-only image links); NoSQL query sanitising.
- No internal error details are leaked to clients.
- Frontend nginx sends CSP, `X-Frame-Options`, `nosniff` and `Referrer-Policy` headers.

## Docker

```bash
# Backend (uploads are kept in a volume)
docker build -t travelmemory-be ./backend
docker run -p 3001:3001 -e MONGO_URI=... -e CORS_ORIGIN=http://localhost -v tm-uploads:/app/uploads travelmemory-be

# Frontend (the backend URL is baked in at build time)
docker build -t travelmemory-fe --build-arg REACT_APP_BACKEND_URL=http://localhost:3001 ./frontend
docker run -p 80:80 travelmemory-fe
```
