# Stage 1: Build React app
FROM node:18-alpine AS builder
WORKDIR /app
ARG REACT_APP_BACKEND_URL=http://localhost:3001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
