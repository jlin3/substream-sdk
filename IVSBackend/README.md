# IVS Streaming Backend

> **⚠️ FOR SERVICE OPERATORS ONLY**
>
> This backend is intended for **k-ID/Bezi service operators** who are hosting the streaming infrastructure.
>
> **If you are a game developer** integrating streaming into your Unity project, you do NOT need to set up this backend. Instead, see the [SDK Streaming Guide](../SDK_STREAMING_GUIDE.md) for simple integration instructions.

---

## What This Is

This is the server-side component that:
- Manages AWS IVS channels and stream keys
- Handles user authentication and authorization
- Provides playback URLs and JWT tokens
- Tracks streaming sessions in a database

Game developers connect to this backend via API - they don't run it themselves.

---

## Requirements (For Operators)

- Node.js 18+
- PostgreSQL database
- AWS account with IVS permissions
- pnpm package manager

## Setup (For Operators)

```bash
# Install dependencies
pnpm install

# Configure environment
cp env.example.txt .env
# Edit .env with your AWS and database credentials

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed test data (optional)
pnpm db:seed

# Start development server
pnpm dev
```

See [IVS_BACKEND_SETUP.md](../IVS_BACKEND_SETUP.md) for complete AWS setup instructions.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/streams/children/:childId/ingest` | POST | Get RTMPS credentials |
| `/api/streams/children/:childId/sessions` | POST | Create streaming session |
| `/api/streams/children/:childId/playback` | GET | Get playback URL |
| `/api/streams/sessions/:sessionId` | DELETE | End session |
| `/api/streams/sessions/:sessionId/heartbeat` | POST | Keep session alive |

---

## Environment Variables

See `env.example.txt` for all required configuration.
