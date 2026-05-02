FROM node:25-alpine3.22
WORKDIR /app
COPY . .
RUN npm install
ENV PORT=3001
ENV MONGO_URI=''
EXPOSE 3001
CMD [ "node", "index.js" ]
