# BodyArcade Flight (fork of GlobeFly / TinySkies)

**TinySkies / GlobeFly by [Danny Limanseta](https://github.com/dannylimanseta/tinyskies)
is used with permission.** This directory is a faithful fork adapted for
BodyArcade: fully offline single-player by default (LocalWorldProvider,
no Postgres/server needed), body-controlled flight via
`@bodyarcade/body-input`, zero analytics/telemetry. The upstream server
remains runnable via docker-compose for multiplayer experiments. See
`../../ARCHITECTURE.md`, `../../ASSETS.md` (per-file manifest), and the
root README for the BodyArcade side.

Run it: `npm run arcade` at the repo root (serves the built game at
http://localhost:5173/flight/ on PosePuppet's origin so body signals
flow), or `npm run dev:client` here for standalone game-only dev.

Actual keyboard controls (the table below is upstream's original text;
its W/S/Shift/Ctrl rows predate the current code): **A/D turn · W
accelerate · S brake · ArrowUp climb · Space paintball/action · F
interact.** Body input maps through profiles — press `B` in-game.

---

# Upstream README (GlobeFly)

# GlobeFly

Multiplayer Three.js game where players fly planes around customizable globes.

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- PostgreSQL running locally (or via Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

```bash
# Start Postgres (if using Docker)
docker run -d --name globefly-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=globefly -p 5432:5432 postgres:16

# Generate Prisma client and run migrations
cd server
npx prisma generate
npx prisma migrate dev --name init
cd ..
```

### 3. Run both client and server

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

### 4. Play

1. Open the client in your browser
2. Create a world (give it a name and pick a texture)
3. Copy the world code
4. Open another tab, paste the code, and join with a different name
5. Fly around together!

## Controls

| Key | Action |
|-----|--------|
| W / S | Pitch down / up |
| A / D | Turn left / right |
| Shift | Speed up |
| Ctrl | Slow down |
| Arrow Up | Fly upwards (altitude) |
| Space | Fire paintball |

## Deployment

Production URLs:
- **Client**: https://tinyskies.vercel.app (Vercel)
- **Server API**: Railway (or any Docker host)

### One-command deploy (recommended)

Deploy **both** server (Railway) and client (Vercel) in one shot:

```bash
npm run deploy
```

This runs `railway up` then `vercel deploy --prod` sequentially so the API is live before the new frontend goes out.

Deploy individually when you only changed one side:

```bash
npm run deploy:server   # Railway only
npm run deploy:client   # Vercel only
npm run deploy:preview  # Vercel preview (non-production)
```

### First-time setup (once per machine)

**1. Railway CLI**

```bash
npm i -g @railway/cli
railway login
railway link    # select the globefly-server project
```

**2. Vercel CLI**

```bash
npx vercel login
npx vercel link   # select the tinyskies project
```

**3. Server URL for the client**

Edit `client/.env.production` and set `VITE_SERVER_URL` to your Railway API URL:

```
VITE_SERVER_URL=https://globefly-api-production.up.railway.app
```

Commit the file. Vite reads it on every production build so Vercel picks it up automatically -- no Vercel dashboard env setup needed for the API URL.

Alternatively, set `SERVER_URL` in Vercel environment variables -- the client fetches it at runtime via `/api/server-url` (no rebuild needed when the URL changes).

### Environment variables

**Server (Railway dashboard or `railway variables`)**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLIENT_URL` | `https://tinyskies.vercel.app` (for CORS; comma-separated for extras) |
| `PORT` | `3001` (or Railway's assigned port) |

**Client (committed in repo -- no dashboard needed)**

| File | Variable | Purpose |
|------|----------|---------|
| `client/.env.production` | `VITE_SERVER_URL` | Baked into the bundle at build time |

Local dev keeps defaults: client `http://localhost:5173`, server `http://localhost:3001`.

## Tech Stack

- **Client**: Vite, TypeScript, Three.js, Socket.io
- **Server**: Node.js, Express, Socket.io, Prisma
- **Database**: PostgreSQL
- **Architecture**: Quaternion-based spherical math for singularity-free globe flight, relay server with client-side prediction and slerp interpolation
