# IEMBot WebSocket Server

A WebSocket backend for real-time chat + polygon sync for KSROC and KSNT.

## Running locally

npm install npm start

Server runs on port 8080 by default.

## Deploying to Render
1. Push this folder to a GitHub repo.
2. Go to https://dashboard.render.com
3. Create a **New Web Service**
4. Connect your repo
5. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Deploy

Render will assign a permanent URL like: wss://iembot-server.onrender.com


Use this URL in your admin + viewer.



