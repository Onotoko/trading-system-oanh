# Mini Trading System Architecture

## Overview
This document outlines the high-level system design for a mini trading platform designed to handle cryptocurrency trading operations with focus on performance, scalability, and security.

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile Client  │    │  Admin Panel    │
│   (React)       │    │   (React)       │    │   (React)       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴──────────────┐
                    │     Load Balancer          │
                    │     (Nginx/HAProxy)        │
                    └─────────────┬──────────────┘
                                 │
                    ┌─────────────┴──────────────┐
                    │     API Gateway            │
                    │   (Rate Limiting,          │
                    │   Authentication)          │
                    └─────────────┬──────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
│  Order Service │    │ Matching Engine  │    │  Market Data     │
│   (Node.js)    │    │   (Node.js)      │    │   Service        │
└───────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
        │                       │                        │
        └────────────────────────┼────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
│ Risk Management│    │  Fee Calculation │    │  Notification    │
│   Service      │    │    Service       │    │   Service        │
└───────┬────────┘    └─────────┬────────┘    └─────────┬────────┘
        │                       │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────▼──────────────┐
                    │     Message Queue          │
                    │      (Redis Pub/Sub)       │
                    └─────────────┬──────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
│  PostgreSQL    │    │     Redis        │    │  WebSocket       │
│  (Primary DB)  │    │    (Cache)       │    │   Service        │
└────────────────┘    └──────────────────┘    └──────────────────┘
```

## Core Components

### 1. Order Management System
**Responsibilities:**
- Order validation and sanitization
- Order lifecycle management (pending, filled, cancelled)
- Order history tracking
- Balance validation before order placement

**Key Features:**
- Support for Market and Limit orders
- Partial fill handling
- Order modification and cancellation
- Real-time order status updates

### 2. Matching Engine
**Responsibilities:**
- Price-time priority matching algorithm
- Order book maintenance
- Trade execution
- Liquidity management

**Key Features:**
- Sub-10ms matching latency
- Support for 1000+ orders/second
- Atomic trade execution
- Real-time order book updates

**Algorithm:**
```
Priority Matching Logic:
1. Price Priority: Best bid/ask prices matched first
2. Time Priority: Earlier orders at same price level matched first
3. Order Size: Partial fills supported for liquidity optimization
```

### 3. Risk Management System
**Responsibilities:**
- Pre-trade risk checks
- Position limit monitoring
- Anti-manipulation detection
- Circuit breaker mechanisms

**Key Features:**
- Real-time balance validation
- Maximum position size limits
- Suspicious trading pattern detection
- Automated risk alerts

### 4. Fee Calculation Engine
**Responsibilities:**
- Dynamic fee calculation
- Tiered fee structure management
- Maker/Taker fee differentiation
- Fee collection and accounting

**Fee Structure:**
- Maker Fee: 0.1% (provides liquidity)
- Taker Fee: 0.15% (removes liquidity)
- Volume-based discounts available

## Database Design

### PostgreSQL Schema

#### Users Table
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    kyc_status VARCHAR(50) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
    fee_tier INTEGER DEFAULT 1 CHECK (fee_tier BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
```

#### Orders Table
```sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL CHECK (symbol = UPPER(symbol)),
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type VARCHAR(10) NOT NULL CHECK (type IN ('MARKET', 'LIMIT')),
    quantity DECIMAL(20,8) NOT NULL CHECK (quantity > 0),
    price DECIMAL(20,8) CHECK (price > 0),
    filled_quantity DECIMAL(20,8) DEFAULT 0 CHECK (filled_quantity >= 0),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'FILLED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_symbol_status ON orders(symbol, status);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_symbol_side_price ON orders(symbol, side, price) WHERE status IN ('PENDING', 'PARTIAL');
```

#### Trades Table
```sql
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL CHECK (symbol = UPPER(symbol)),
    buyer_order_id BIGINT REFERENCES orders(id),
    seller_order_id BIGINT REFERENCES orders(id),
    quantity DECIMAL(20,8) NOT NULL CHECK (quantity > 0),
    price DECIMAL(20,8) NOT NULL CHECK (price > 0),
    buyer_fee DECIMAL(20,8) NOT NULL CHECK (buyer_fee >= 0),
    seller_fee DECIMAL(20,8) NOT NULL CHECK (seller_fee >= 0),
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_symbol_time ON trades(symbol, executed_at DESC);
CREATE INDEX idx_trades_buyer_order ON trades(buyer_order_id);
CREATE INDEX idx_trades_seller_order ON trades(seller_order_id);
```

#### Balances Table
```sql
CREATE TABLE balances (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    asset VARCHAR(20) NOT NULL CHECK (asset = UPPER(asset)),
    available DECIMAL(20,8) DEFAULT 0 CHECK (available >= 0),
    locked DECIMAL(20,8) DEFAULT 0 CHECK (locked >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, asset)
);

CREATE INDEX idx_balances_user ON balances(user_id);
CREATE INDEX idx_balances_asset ON balances(asset);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trg_balances_updated_at
    BEFORE UPDATE ON balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### Risk Events Table
```sql
CREATE TABLE risk_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('WITHDRAWAL', 'DEPOSIT', 'TRADE', 'LOGIN', 'SUSPICIOUS_ACTIVITY')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_events_user_time ON risk_events(user_id, created_at DESC);
CREATE INDEX idx_risk_events_type ON risk_events(event_type);
CREATE INDEX idx_risk_events_severity ON risk_events(severity);
CREATE INDEX idx_risk_events_unresolved ON risk_events(resolved) WHERE resolved = false;

CREATE TRIGGER trg_risk_events_updated_at
    BEFORE UPDATE ON risk_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Redis Data Structures

#### Order Book Cache
```
Key: orderbook:{symbol}:bids
Type: Sorted Set
Score: Price (DESC for bids)
Value: JSON({orderId, quantity, timestamp})

Key: orderbook:{symbol}:asks  
Type: Sorted Set
Score: Price (ASC for asks)
Value: JSON({orderId, quantity, timestamp})
```

#### User Sessions
```
Key: session:{userId}
Type: Hash
Fields: {token, lastActivity, permissions}
TTL: 24 hours
```

#### Rate Limiting
```
Key: ratelimit:{userId}:{endpoint}
Type: String (counter)
TTL: 60 seconds
```
