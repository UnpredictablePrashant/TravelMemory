# 🌍 Travel Memory Application Deployment (MERN Stack)

## 📌 Project Overview

The **Travel Memory Application** is a full-stack MERN (MongoDB, Express, React, Node.js) application deployed on **AWS EC2** with **Nginx reverse proxy**, **Load Balancer (ALB)**, and optional **Cloudflare domain integration**.

This project demonstrates real-world deployment skills including backend setup, frontend integration, scalability, and production best practices.

---

## 🏗️ Architecture

```
User (Browser)
     ↓
Cloudflare (Optional)
     ↓
AWS Application Load Balancer (ALB)
     ↓
EC2 Instance (Ubuntu)
     ↓
Nginx (Reverse Proxy)
     ↓
React Frontend (Static Build)
     ↓
/api → Node.js Backend (Express)
     ↓
MongoDB Atlas
```

---

## ⚙️ Technologies Used

* **Frontend:** React.js
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas
* **Server:** AWS EC2 (Ubuntu)
* **Reverse Proxy:** Nginx
* **Process Manager:** PM2
* **Load Balancer:** AWS ALB
* **DNS (Optional):** Cloudflare

---

## 🔧 Backend Configuration

### 1. Navigate to backend

```bash
cd backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Create `.env` file:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
```

> Note: `.env` is not committed. Use `.env.example` for reference.

---

### 4. Run Backend using PM2

```bash
npm install -g pm2
pm2 start index.js --name backend
pm2 save
```

---

### 5. Backend API

```
http://<EC2-IP>:3000/api/trip
```

---

## 🎨 Frontend Configuration

### 1. Navigate to frontend

```bash
cd frontend
```

### 2. Update API URL

📁 `src/url.js`

```js
export const baseUrl = "http://<ALB-DNS>/api";
```

---

### 3. Build React App

```bash
npm install
npm run build
```

---

## 🌐 Nginx Configuration

### File Location:

```
/etc/nginx/sites-available/default
```

### Configuration:

```nginx
server {
    listen 80;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location / {
        root /home/ubuntu/TravelMemory/frontend/build;
        index index.html;
        try_files $uri /index.html;
    }
}
```

### Restart Nginx:

```bash
sudo systemctl restart nginx
```

---

## ⚖️ Load Balancer Setup (ALB)

* Create **Application Load Balancer**
* Add EC2 instance as target
* Configure **Health Check Path**:

```
/hello
```

### Health Check URL:

```
http://<ALB-DNS>/hello
```

Expected response:

```
Hello World!
```

---

## 🌍 Cloudflare Domain Setup (Optional)

### 1. Add domain to Cloudflare

### 2. Configure DNS

#### A Record (EC2)

```
Type: A
Name: @
Value: <EC2 Public IP>
```

#### CNAME (ALB)

```
Type: CNAME
Name: www
Target: <ALB DNS>
```

---

## 🧪 Testing URLs

### Backend (Direct)

```
http://localhost:3000/api/trip
```

### Nginx (Local)

```
http://localhost/api/trip
```

### EC2

```
http://<EC2-IP>
```

### ALB

```
http://<ALB-DNS>
http://<ALB-DNS>/api/trip
```

---

## 🔐 Best Practices

### ✅ Security

* Sensitive data stored in `.env`
* `.env` excluded via `.gitignore`
* Use MongoDB Atlas (secured access)

---

### ⚡ Scalability

* Backend managed using PM2 cluster mode
* Load balancing using AWS ALB
* Stateless backend design

---

### 🛡️ Resilience

* Auto-restart with PM2
* Health check endpoint (`/hello`)
* Nginx reverse proxy for stability

---

## 📸 Screenshots (Add in Submission)

* EC2 Instance running
* Application UI
* Nginx configuration
* Cloudflare DNS setup
* ALB target group health check

---

## 🚀 Deployment Status

✅ Backend deployed
✅ Frontend deployed
✅ Nginx configured
✅ Load Balancer working
✅ API integration successful

---

## 📂 GitHub Repository

> Add your repository link here before submission

---

## 👨‍💻 Author

**Vivek Rajendran**
Lead Software Engineer | Java & Cloud Specialist

---

## 📌 Conclusion

This project demonstrates end-to-end deployment of a MERN stack application using AWS infrastructure, highlighting real-world DevOps practices including reverse proxy setup, load balancing, and scalable architecture.

---
