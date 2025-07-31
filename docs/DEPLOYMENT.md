# Deployment Guide

## Overview
This guide provides comprehensive deployment instructions for the Mini Trading System, covering local development, staging, and production environments.

## Prerequisites

### System Requirements
- **Node.js:** >= 18.0.0
- **PostgreSQL:** >= 14.0
- **Redis:** >= 6.2
- **Docker:** >= 20.10.0
- **Docker Compose:** >= 2.0.0

### Environment Setup
```bash
# Install Node.js dependencies
npm install

# Install development tools
npm install -g typescript nodemon prisma

# Verify installations
node --version    # Should be >= 18.0.0
npm --version     # Should be >= 8.0.0
docker --version  # Should be >= 20.10.0
```

## Local Development Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd trading-system-demo

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 2. Database Setup
```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Navigate to backend directory
cd backend

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database with initial data
npm run db:seed

# Return to root
cd ..
```

### 3. Environment Configuration
Create `backend/.env` file:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/trading_dev"
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"

# Security
JWT_SECRET="your-development-jwt-secret-minimum-32-chars"
JWT_REFRESH_SECRET="your-development-refresh-secret-minimum-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Max requests per window

# Trading Configuration
MAKER_FEE=0.001
TAKER_FEE=0.0015
MAX_ORDER_SIZE=1000000
MIN_ORDER_SIZE=0.00000001

# Logging
LOG_LEVEL="debug"
```

Create `frontend/.env` file:
```env
# API Configuration
REACT_APP_API_URL="http://localhost:3001"
REACT_APP_WS_URL="ws://localhost:3001"

# Environment
REACT_APP_NODE_ENV="development"
REACT_APP_VERSION="1.0.0"

# Feature Flags
REACT_APP_ENABLE_ADVANCED_FEATURES=true
REACT_APP_ENABLE_MOCK_DATA=true
```

### 4. Start Development Servers
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend  
npm start

# Verify services
curl http://localhost:3001/health
curl http://localhost:3000
```

## Docker Development Setup

### Quick Start with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  # Backend API Service
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/trading_dev
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=http://localhost:3000
    depends_on:
      - postgres
      - redis
    command: npm run dev
    volumes:
      - ./backend:/app
      - /app/node_modules

  # Frontend React App
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:3001
      - REACT_APP_WS_URL=ws://localhost:3001
    depends_on:
      - backend
    command: npm start
    volumes:
      - ./frontend:/app
      - /app/node_modules

  # PostgreSQL Database
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: trading_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis Cache
  redis:
    image: redis:6.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Production Deployment

### 1. Build Process
```bash
# Build Backend
cd backend
npm ci --only=production
npm run build
npx prisma generate --schema=./prisma/schema.prisma

# Build Frontend
cd ../frontend
npm ci --only=production
npm run build

# Return to root
cd ..
```

### 2. Production Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:password@prod-db:5432/trading_prod"
REDIS_URL="redis://prod-redis:6379"

# Application
NODE_ENV="production"
PORT=3001
FRONTEND_URL="https://your-domain.com"

# Security (Use strong secrets!)
JWT_SECRET="your-super-secure-production-jwt-secret-64-chars-minimum"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret-64-chars-minimum"

# Rate Limiting (Stricter for production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

# Monitoring
LOG_LEVEL="warn"
ENABLE_METRICS=true
```

### 3. Database Migration for Production
```bash
# Run migrations in production
npx prisma migrate deploy

# Verify database connection
npm run db:check
```

### 4. Production Docker Setup
```dockerfile
# Backend Dockerfile
FROM node:18-alpine AS backend-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY backend/ .
RUN npm run build
RUN npx prisma generate

FROM node:18-alpine AS backend-production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S trading -u 1001

WORKDIR /app

COPY --from=backend-builder --chown=trading:nodejs /app/node_modules ./node_modules
COPY --from=backend-builder --chown=trading:nodejs /app/dist ./dist
COPY --from=backend-builder --chown=trading:nodejs /app/prisma ./prisma
COPY --from=backend-builder --chown=trading:nodejs /app/package*.json ./

USER trading

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "start"]

---

# Frontend Dockerfile
FROM node:18-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ .
RUN npm run build

FROM nginx:alpine AS frontend-production

# Copy custom nginx config
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built app
COPY --from=frontend-builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Kubernetes Deployment

### 1. ConfigMap and Secrets
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: trading-system-config
data:
  NODE_ENV: "production"
  PORT: "3001"
  LOG_LEVEL: "info"
  RATE_LIMIT_WINDOW_MS: "900000"
  RATE_LIMIT_MAX: "1000"

---
# k8s/secrets.yaml (Create manually or use CI/CD)
apiVersion: v1
kind: Secret
metadata:
  name: trading-system-secrets
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  JWT_REFRESH_SECRET: <base64-encoded-refresh-secret>
```

### 2. Deployment Configuration
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trading-system-api
  labels:
    app: trading-system-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trading-system-api
  template:
    metadata:
      labels:
        app: trading-system-api
    spec:
      containers:
      - name: api
        image: trading-system:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: trading-system-config
        - secretRef:
            name: trading-system-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 3. Service and Ingress
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: trading-system-service
spec:
  selector:
    app: trading-system-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trading-system-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: trading-system-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: trading-system-service
            port:
              number: 80
```

## Monitoring and Logging

### Health Checks
```bash
# Basic health check
curl http://localhost:3001/health

# Database connectivity
curl http://localhost:3001/health/db

# Redis connectivity  
curl http://localhost:3001/health/redis

# Detailed system info
curl http://localhost:3001/health/detailed
```

### Log Configuration
```javascript
// Production logging setup
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## Security Considerations

### Production Security Checklist
- [ ] Use strong, unique secrets for JWT tokens
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure proper CORS origins
- [ ] Implement rate limiting with Redis backend
- [ ] Set up Web Application Firewall (WAF)
- [ ] Enable audit logging for all API calls
- [ ] Use environment variables for all secrets
- [ ] Regular security updates for dependencies
- [ ] Database connection encryption
- [ ] Redis AUTH configuration

### Network Security
```yaml
# Example network policy for Kubernetes
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: trading-system-netpol
spec:
  podSelector:
    matchLabels:
      app: trading-system-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 3001
```

## Backup and Recovery

### Database Backup
```bash
# Automated daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"

# Create backup
pg_dump $DATABASE_URL > "$BACKUP_DIR/trading_backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/trading_backup_$DATE.sql"

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### Redis Backup
```bash
# Redis snapshot backup
redis-cli --rdb /backups/redis/dump_$(date +%Y%m%d_%H%M%S).rdb
```

## Performance Optimization

### Production Tuning
```bash
# Node.js production flags
export NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"

# PM2 process management
pm2 start ecosystem.config.js --env production
```

### Database Optimization
```sql
-- Production PostgreSQL settings
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

## Troubleshooting

### Common Issues
1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   npx prisma db pull
   
   # Reset database (development only)
   npx prisma migrate reset
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   redis-cli ping
   
   # Check Redis memory usage
   redis-cli info memory
   ```

3. **Performance Issues**
   ```bash
   # Monitor application performance
   npm run monitor
   
   # Database query analysis
   npm run db:analyze
   ```

### Log Analysis
```bash
# Search for errors in logs
grep -i "error" logs/combined.log

# Monitor real-time logs
tail -f logs/combined.log | grep -E "(ERROR|WARN)"

# Performance monitoring
npm run perf:monitor
```

## Rollback Procedures

### Application Rollback
```bash
# Kubernetes rollback
kubectl rollout undo deployment/trading-system-api

# Docker rollback
docker-compose down
docker-compose up -d --force-recreate
```

### Database Rollback
```bash
# Prisma migration rollback (if needed)
npx prisma migrate resolve --rolled-back <migration-name>
```