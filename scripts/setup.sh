#!/bin/bash

# Mini Trading System - Development Environment Setup Script
# This script sets up the complete development environment for the trading system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_NODE="18.0.0"
        if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE" ]; then
            log_error "Node.js version $NODE_VERSION is too old. Required: >= $REQUIRED_NODE"
            missing_deps+=("node")
        else
            log_success "Node.js $NODE_VERSION ✓"
        fi
    else
        log_error "Node.js not found"
        missing_deps+=("node")
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        log_success "npm $NPM_VERSION ✓"
    else
        log_error "npm not found"
        missing_deps+=("npm")
    fi
    
    # Check Docker
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        log_success "Docker $DOCKER_VERSION ✓"
    else
        log_error "Docker not found"
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        if command_exists docker-compose; then
            COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | tr -d ',')
        else
            COMPOSE_VERSION=$(docker compose version --short)
        fi
        log_success "Docker Compose $COMPOSE_VERSION ✓"
    else
        log_error "Docker Compose not found"
        missing_deps+=("docker-compose")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install missing dependencies and run this script again"
        exit 1
    fi
    
    log_success "All prerequisites satisfied!"
}

# Create environment file
create_env_file() {
    log_info "This function has been replaced by create_env_files"
}

# Install dependencies
install_dependencies() {
    log_info "This function has been replaced by install_project_dependencies"
}

# Setup Docker services
setup_docker_services() {
    log_info "Setting up Docker services (PostgreSQL & Redis)..."
    
    # Create docker-compose.yml if it doesn't exist
    if [ ! -f "docker-compose.yml" ]; then
        log_info "Creating docker-compose.yml..."
        cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: trading_postgres
    environment:
      POSTGRES_DB: trading_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: trading123
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d trading_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:6.2-alpine
    container_name: trading_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Optional: Redis Commander for Redis GUI
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: trading_redis_commander
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis
    profiles:
      - tools

  # Optional: pgAdmin for PostgreSQL GUI
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: trading_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@trading.local
      PGADMIN_DEFAULT_PASSWORD: admin123
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "8080:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      - postgres
    profiles:
      - tools

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  pgadmin_data:
    driver: local
EOF
    fi
    
    # Start Docker services
    log_info "Starting Docker services..."
    docker-compose up -d postgres redis
    
    # Wait for services to be healthy
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps postgres | grep -q "Up"; then
        log_success "PostgreSQL is running ✓"
    else
        log_error "PostgreSQL failed to start"
        exit 1
    fi
    
    if docker-compose ps redis | grep -q "Up"; then
        log_success "Redis is running ✓"
    else
        log_error "Redis failed to start"
        exit 1
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database schema..."
    
    # Wait for PostgreSQL to be fully ready
    log_info "Waiting for PostgreSQL to be ready..."
    until docker-compose exec -T postgres pg_isready -U postgres -d trading_dev; do
        log_info "Waiting for PostgreSQL..."
        sleep 2
    done
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations
    log_info "Running database migrations..."
    npx prisma migrate dev --name init || {
        log_warning "Migration failed, trying to create and migrate..."
        npx prisma migrate reset --force
        npx prisma migrate dev --name init
    }
    
    # Seed database with initial data
    if [ -f "prisma/seed.ts" ] || [ -f "scripts/seed.js" ]; then
        log_info "Seeding database with initial data..."
        npm run db:seed || log_warning "Database seeding skipped (no seed script found)"
    else
        log_info "No seed script found, skipping database seeding"
    fi
    
    log_success "Database setup completed!"
}

# Create necessary directories
create_directories() {
    log_info "Creating project directories..."
    
    mkdir -p logs
    mkdir -p uploads
    mkdir -p backups
    mkdir -p docs/api
    mkdir -p tests/integration
    mkdir -p tests/unit
    mkdir -p scripts
    
    log_success "Project directories created!"
}

# Create additional scripts
create_scripts() {
    log_info "Creating utility scripts..."
    
    # Create database management script
    cat > scripts/db-utils.sh << 'EOF'
#!/bin/bash
# Database utility functions

case "$1" in
    "reset")
        echo "Resetting database..."
        cd backend && npx prisma migrate reset --force
        ;;
    "migrate")
        echo "Running migrations..."
        cd backend && npx prisma migrate dev
        ;;
    "seed")
        echo "Seeding database..."
        cd backend && npm run db:seed
        ;;
    "backup")
        echo "Creating database backup..."
        docker-compose exec -T postgres pg_dump -U postgres trading_dev > "backups/backup_$(date +%Y%m%d_%H%M%S).sql"
        ;;
    "restore")
        if [ -z "$2" ]; then
            echo "Usage: $0 restore <backup_file>"
            exit 1
        fi
        echo "Restoring database from $2..."
        docker-compose exec -T postgres psql -U postgres -d trading_dev < "$2"
        ;;
    *)
        echo "Usage: $0 {reset|migrate|seed|backup|restore <file>}"
        exit 1
        ;;
esac
EOF
    
    # Create development script
    cat > scripts/dev.sh << 'EOF'
#!/bin/bash
# Development helper script

case "$1" in
    "start")
        echo "Starting development environment..."
        docker-compose up -d postgres redis
        echo "Backend: http://localhost:3001"
        echo "Frontend: http://localhost:3000"
        echo "PgAdmin: http://localhost:8080 (admin@trading.local / admin123)"
        echo "Redis Commander: http://localhost:8081"
        ;;
    "stop")
        echo "Stopping development environment..."
        docker-compose down
        ;;
    "logs")
        if [ -z "$2" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$2"
        fi
        ;;
    "clean")
        echo "Cleaning development environment..."
        docker-compose down -v
        docker system prune -f
        ;;
    *)
        echo "Usage: $0 {start|stop|logs [service]|clean}"
        exit 1
        ;;
esac
EOF
    
    # Create test script
    cat > scripts/test.sh << 'EOF'
#!/bin/bash
# Testing utility script

case "$1" in
    "unit")
        echo "Running unit tests..."
        cd backend && npm run test:unit
        cd ../frontend && npm run test
        ;;
    "integration")
        echo "Running integration tests..."
        cd backend && npm run test:integration
        ;;
    "e2e")
        echo "Running end-to-end tests..."
        cd frontend && npm run test:e2e
        ;;
    "coverage")
        echo "Running tests with coverage..."
        cd backend && npm run test:coverage
        cd ../frontend && npm run test:coverage
        ;;
    "all")
        echo "Running all tests..."
        $0 unit
        $0 integration
        $0 e2e
        ;;
    *)
        echo "Usage: $0 {unit|integration|e2e|coverage|all}"
        exit 1
        ;;
esac
EOF
    
    # Make scripts executable
    chmod +x scripts/*.sh
    
    log_success "Utility scripts created!"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check if backend dependencies are installed
    if [ -d "backend/node_modules" ]; then
        log_success "Backend dependencies installed ✓"
    else
        log_error "Backend dependencies not found"
        return 1
    fi
    
    # Check if frontend dependencies are installed
    if [ -d "frontend/node_modules" ]; then
        log_success "Frontend dependencies installed ✓"
    else
        log_error "Frontend dependencies not found"
        return 1
    fi
    
    # Check if Docker services are running
    if docker-compose ps postgres | grep -q "Up"; then
        log_success "PostgreSQL service running ✓"
    else
        log_error "PostgreSQL service not running"
        return 1
    fi
    
    if docker-compose ps redis | grep -q "Up"; then
        log_success "Redis service running ✓"
    else
        log_error "Redis service not running"
        return 1
    fi
    
    # Test database connection
    log_info "Testing database connection..."
    cd backend
    if npx prisma db pull >/dev/null 2>&1; then
        log_success "Database connection successful ✓"
    else
        log_error "Database connection failed"
        cd ..
        return 1
    fi
    cd ..
    
    # Test Redis connection
    log_info "Testing Redis connection..."
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis connection successful ✓"
    else
        log_error "Redis connection failed"
        return 1
    fi
    
    log_success "All verification checks passed!"
}

# Install project dependencies
install_project_dependencies() {
    log_info "Installing project dependencies..."
    
    # Install backend dependencies
    if [ -d "backend" ]; then
        log_info "Installing backend dependencies..."
        cd backend
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
        cd ..
    else
        log_error "Backend directory not found"
        exit 1
    fi
    
    # Install frontend dependencies
    if [ -d "frontend" ]; then
        log_info "Installing frontend dependencies..."
        cd frontend
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
        cd ..
    else
        log_error "Frontend directory not found"
        exit 1
    fi
    
    log_success "Project dependencies installed successfully!"
}

# Create environment files for both backend and frontend
create_env_files() {
    log_info "Creating environment configuration files..."
    
    # Backend environment
    if [ -f "backend/.env" ]; then
        log_warning "Backend .env file already exists. Creating backup..."
        cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    cat > backend/.env << 'EOF'
# Database Configuration
DATABASE_URL="postgresql://postgres:trading123@localhost:5432/trading_dev"
REDIS_URL="redis://localhost:6379"

# Application Configuration
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"

# Security Configuration
JWT_SECRET="dev-jwt-secret-minimum-32-characters-for-security"
JWT_REFRESH_SECRET="dev-refresh-secret-minimum-32-characters-for-security"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Trading Configuration
MAKER_FEE=0.001
TAKER_FEE=0.0015
MAX_ORDER_SIZE=1000000
MIN_ORDER_SIZE=0.00000001

# Logging Configuration
LOG_LEVEL="debug"
ENABLE_METRICS=true
ENABLE_SWAGGER=true

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS_PER_USER=5

# Development Flags
ENABLE_CORS=true
ENABLE_DEBUG_LOGGING=true
MOCK_EXTERNAL_SERVICES=true
EOF
    
    # Frontend environment
    if [ -f "frontend/.env" ]; then
        log_warning "Frontend .env file already exists. Creating backup..."
        cp frontend/.env frontend/.env.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    cat > frontend/.env << 'EOF'
# API Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001

# Environment Configuration
REACT_APP_NODE_ENV=development
REACT_APP_VERSION=1.0.0

# Feature Flags
REACT_APP_ENABLE_ADVANCED_FEATURES=true
REACT_APP_ENABLE_MOCK_DATA=true
REACT_APP_DEBUG_MODE=true

# UI Configuration
REACT_APP_THEME=dark
REACT_APP_DEFAULT_SYMBOL=BTCUSDT
EOF
    
    log_success "Environment files created successfully!"
}

# Main setup function
main() {
    log_info "Starting Mini Trading System development environment setup..."
    echo "=================================================="
    
    # Run setup steps
    check_prerequisites
    create_directories
    create_env_files
    install_project_dependencies
    setup_docker_services
    setup_database
    create_scripts
    verify_installation
    
    echo "=================================================="
    log_success "Setup completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "1. Start backend: cd backend && npm run dev"
    echo "2. Start frontend: cd frontend && npm start"
    echo "3. Access the application:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:3001"
    echo "   - API Documentation: http://localhost:3001/api-docs"
    echo "   - PgAdmin: http://localhost:8080 (admin@trading.local / admin123)"
    echo "   - Redis Commander: http://localhost:8081"
    echo ""
    log_info "Useful commands:"
    echo "- ./scripts/dev.sh start    # Start development services"
    echo "- ./scripts/dev.sh stop     # Stop development services"
    echo "- ./scripts/db-utils.sh reset # Reset database"
    echo "- ./scripts/test.sh all     # Run all tests"
    echo ""
    log_success "Happy coding! 🚀"
}

# Run main function
main "$@"