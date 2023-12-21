# Travel Memory

`.env` file to work with the backend:

```
MONGO_URI='ENTER_YOUR_URL'
PORT=3000
```

Data format to be added: 

```json
{
    "tripName": "Incredible India",
    "startDateOfJourney": "19-03-2022",
    "endDateOfJourney": "27-03-2022",
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

_______________________________________________________________________________________________________________________________________
Let's work on the execution of this project

First, create your account on MongoDB and deploy your cluster better to use M0 free cluster for learning purposes then create user credentials with read and write permission, Use MongoDBCompus to check the login credentials.
```
https://account.mongodb.com/account/login?n=%2Fv2%2F6519492b8cbd8711f6f61f10&nextHash=%23clusters
```
Create two Amazon EC2 instances with Ubuntu OS and security group that allow all IPs one for the front end and the other back end.
once connected with the instance update the software and install git 
```
sudo apt update
sudo apt-get install git -y
```
Then clone the repository
```
git clone
```
Install node js and npm on the instances
```
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# version 18

NODE_MAJOR=18
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
```
```
sudo apt-get update
sudo apt-get install nodejs -y
```
make sure you did node installation on both of your frontend and backend.
Let's see the changes that need to be done on the backend first.
# Backend instance
once connected with your backend instance move to the Travelmemory folder which was cloned.
```
cd Travelmemory
```
then move to the backend folder and create a .env file which helps to connect with the database.
```
cd backend
```
```
nano .env
```
copy paste the URL from the MongoDB atlas connection.
<password> defines your password for the user
```
MONGO_URI='mongodb+srv://travelmemory:<password>@travelmemory.9unov3y.mongodb.net/'
PORT=3000
```
Then initialize npm in your backend folder

```
npm init -y

npm install

node index.js
```
Make sure your EC2 instance security group allows port 3000.
Server started at http://localhost:3000
* localhost is your public IP
Output must be --  Cannot GET /
# Installing nginx and reverse proxy in the Backend instance
Installing nginx and doing reverse proxy to http://localhost:3000

```
sudo apt install nginx -y

sudo systemctl start nginx

sudo systemctl enable nginx
```
Change the sites-available default file 
```
cd /etc/nginx/sites-available
nano default
```
update the comments mentioned below in the location part 
```
proxy_pass http://localhost:3000;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_cache_bypass $http_upgrade;
```
restart nginx server
```
sudo systemctl restart nginx
```
Now check the public IP of your EC2 instance

http://public_ip:80

Output must be --  Cannot GET /
!!! congrats reverse proxy to nginx server is done in your instance!!!


# Front-end instance 
Let's connect with your frontend instance move to src folder
```
cd TravelMemory/frontend/src/
```
open url.js file and update the backend instance IP address to connect.
```
export const baseUrl = "http://localhost:3000"
```
localhost is your backend instance public IP
Then initialize npm in your frontend folder
```
npm init -y

npm install

npm start
```
your server starts, check the web browser http://localhost:3000
* localhost is your frontend public IP 
# Install nginx and do reverse proxy similar to a backend instance. 
Now check the public IP of your EC2 instance

http://public_ip:80

# Domain Purchase, DNS configuration, and CloudFlare Setup

* **Domain Purchase:**
   - Visit a domain registrar like GoDaddy.(URL: https://www.godaddy.com/en-in )
   - Search for your desired domain name and complete the purchase process.
* **DNS Configuration at Registrar:**
* Log in to your domain registrar’s dashboard.
* Navigate to the DNS management section.
* Add an A record:
– Type: A
– Name: @
– Value: [IP of your frontend EC2 instance]
– TTL: 600 (or as per your preference)
* **Setting up CloudFlare:**
* Register and log in to Cloudflare.(URL: https://dash.cloudflare.com/login )
* Add your new domain to CloudFlare and select the free plan.
* Follow the instructions to change your domain’s nameservers to CloudFlare’s nameservers.
* After the nameserver update, go to the DNS section in CloudFlare.
* Add an A record for the frontend server and another for the backend server:
– Frontend: Type: A, Name: [domain name], IP Address:
[frontend EC2 IP], Proxy status: DNS only (unproxied)
– Backend (API): Type: A, Name: api, IP Address: [backend
EC2 IP], Proxy status: DNS only (unproxied)
* Updating Frontend Application:
* Update the frontend/src/url.js file to use the new backend API URL (http://api.[your domain name]).
* Restart and Verification:
* Restart both frontend and backend applications to apply the changes.
* Access your domain name via HTTP and verify that the application functions correctly.

# Implementing SSL with Certbo

* Certbot Installation:
• First, ensure Snapd is installed and up to date:
```
sudo apt-get update
sudo apt-get install snapd
```
• Remove any existing Certbot installations (if any):
```
sudo apt-get remove certbot
```
• Install Certbot using snap:
```
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```
*Obtaining SSL Certificate:
• Run Certbot with the Nginx plugin:
```
sudo certbot --nginx
```
• Follow the on-screen instructions to select your domain and obtain
the certificate. Certbot will automatically modify the Nginx configuration to use the SSL certificate.
* Testing and Restarting Nginx:
• Test the Nginx configuration for syntax errors:
```
sudo nginx -t
```
• Restart Nginx to apply the new configuration:
```
sudo systemctl restart nginx
```
* Verification:
* Access your application using https://[your-domain-name] to verify that SSL is working correctly.
* You should see a secure (padlock) icon in the browser’s address bar.

* Updating Frontend Configuration:
• Update the frontend/src/url.js file to use HTTPS for the backend
URL.
• Restart the frontend application to apply the change.
