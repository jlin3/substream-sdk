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

## Cost calculator

This app also serves the public infrastructure cost model at `/cost-calculator`
(live at `https://substream.ai/cost-calculator`), from
`src/components/CostModel/`.

The pricing logic in `src/components/CostModel/model.ts` is **duplicated
verbatim** in `docs-site/src/components/CostModel/model.ts`. The two apps have
separate build graphs and no shared package, so there is no import to keep them
honest — the copies must be kept byte-identical by hand, or the two surfaces
will quote different numbers to the same customer. Check before committing:

```bash
diff IVSBackend/src/components/CostModel/model.ts \
     docs-site/src/components/CostModel/model.ts
```

Only the model is shared. The UI layers differ on purpose: Tailwind here, CSS
modules on the Docusaurus side.

Rates in that file carry a source comment naming the vendor SKU and the date
checked. `docs/PRICING_RECOMMENDATION.md` quotes figures derived from this
model, so changing a rate means re-deriving the numbers in that document too.

---

## Environment Variables

See `env.example.txt` for all required configuration.
# Deployment trigger Tue Jan 13 15:01:57 EST 2026
