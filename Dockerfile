# Image autonome (pour Fly.io, Railway, Koyeb, un VPS…). Non nécessaire pour Render.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV PORT=3001 DATA_DIR=/app/data
EXPOSE 3001
CMD ["npm", "start"]
