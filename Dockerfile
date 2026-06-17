FROM node:22-slim AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY bridge/package*.json ./bridge/
RUN cd bridge && npm install
COPY bridge/ ./bridge/
COPY --from=builder /app/frontend/dist ./frontend/dist
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app
EXPOSE 3099
USER appuser
CMD ["node", "bridge/server.js"]
