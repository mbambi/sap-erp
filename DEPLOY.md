# Deployment Guide — SAP ERP Learning Platform

## Architecture Overview

```
┌──────────────────────┐        ┌──────────────────────┐
│   Static Hosting     │        │   Koyeb (free tier)   │
│   (your domain)      │───────▶│   Node.js backend     │
│   React SPA (dist/)  │  API   │   Express + Prisma    │
└──────────────────────┘        └──────────┬───────────┘
                                           │
                                           ▼
                                ┌──────────────────────┐
                                │   MySQL Database      │
                                │   (remote or local)   │
                                └──────────────────────┘
```

- **Frontend**: Static files served from any web host (Netlify, Vercel, cPanel, etc.)
- **Backend**: Node.js app deployed on Koyeb (or any PaaS)
- **Database**: MySQL 8.0 (e.g., PlanetScale free tier, Railway, Aiven, or your own hosting)

---

## 1. Set Up the MySQL Database

### Option A: Remote MySQL (recommended for production)

Use a hosted MySQL provider:
- **PlanetScale** (free tier, MySQL-compatible): https://planetscale.com
- **Railway** (free trial): https://railway.app
- **Aiven** (free tier): https://aiven.io
- **Your cPanel hosting** (if it offers MySQL)

After creating a database, you'll receive a connection string like:
```
mysql://username:password@host:3306/database_name
```

### Option B: Local MySQL (for testing)

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create the database
CREATE DATABASE bahlaq_sap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user
CREATE USER 'bahlaq'@'localhost' IDENTIFIED BY 'ilyaselasri2005';

-- Grant permissions
GRANT ALL PRIVILEGES ON bahlaq_sap.* TO 'bahlaq'@'localhost';
FLUSH PRIVILEGES;
```

Your connection string will be:
```
mysql://bahlaq:ilyaselasri2005@localhost:3306/bahlaq_sap
```

### Option C: Docker (local development)

```bash
docker-compose up -d mysql
```

This starts MySQL 8.0 with the database `sap_erp` pre-configured. Connection string:
```
mysql://sap_user:sap_password@localhost:3306/sap_erp
```

---

## 2. Configure Environment Variables

Create a `.env` file in the project root (or set these in your hosting provider):

```env
# Database — replace with your actual MySQL connection string
DATABASE_URL="mysql://bahlaq:ilyaselasri2005@localhost:3306/bahlaq_sap"

# Auth — REQUIRED in production. Generate with: openssl rand -hex 32
JWT_SECRET="3ec56771f254c047ca0116e8a9f108a4c987b94cf2a82b22c9258d08f3cfbb34"
JWT_EXPIRY="8h"

# Server
PORT=3001
NODE_ENV=production

# CORS — set to your frontend URL
CORS_ORIGIN="https://bahlaq.com"
```

> **Important**: In production, `JWT_SECRET` must be set. The server will refuse to start without it.

---

## 3. Push the Database Schema

From the project root:

```bash
cd server
npm install
npx prisma db push
```

This creates all tables in your MySQL database. No migration files needed — `db push` syncs the schema directly.

To verify:
```bash
npx prisma studio
```
This opens a web UI at `http://localhost:5555` to inspect your database.

---

## 4. Seed the Database

```bash
cd server
npx prisma db seed
```

This populates the database with:
- **Organization**: ENSAK (École Nationale des Sciences Appliquées de Khouribga)
- **Admin account**: `admin@ensak.ma` / `password123`
- **Teacher account**: `teacher@ensak.ma` / `password123`
- **Roles**: admin, instructor, student, auditor
- **Sample data**: Chart of accounts, vendors, customers, materials, purchase/sales orders, cost centers, employees, courses, and more
- **15 courses** covering all ERP modules

> **Change the default passwords** after first login in a real deployment.

---

## 5. Deploy the Backend (Koyeb)

### 5a. Build locally and push to GitHub

```bash
# From project root
cd server
npm run build          # compiles TypeScript → dist/
```

Make sure your repo is on GitHub. Koyeb deploys from a Git repository.

### 5b. Create a Koyeb app

1. Go to https://app.koyeb.com and create a new **Web Service**
2. Connect your GitHub repo
3. Configure the build:
   - **Builder**: Dockerfile (use the included `Dockerfile`)
   - Or use **Buildpack** with these settings:
     - **Build command**: `cd server && npm install && npx prisma generate && npm run build`
     - **Start command**: `cd server && node dist/index.js`
     - **Port**: `3001`

4. Set environment variables in the Koyeb dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `mysql://bahlaq:ilyaselasri2005@localhost:3306/bahlaq_sap` |
| `JWT_SECRET` | `3ec56771f254c047ca0116e8a9f108a4c987b94cf2a82b22c9258d08f3cfbb34` |
| `JWT_EXPIRY` | `8h` |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `CORS_ORIGIN` | `https://bahlaq.com` |

5. Deploy. Koyeb will give you a URL like `https://your-app-xxxxx.koyeb.app`

### 5c. Run schema + seed on the deployed database

Once the backend is deployed with the correct `DATABASE_URL`, run from your local machine (with the same `DATABASE_URL`):

```bash
cd server
DATABASE_URL="mysql://bahlaq:ilyaselasri2005@localhost:3306/bahlaq_sap" npx prisma db push
DATABASE_URL="mysql://bahlaq:ilyaselasri2005@localhost:3306/bahlaq_sap" npx prisma db seed
```

Or if using PowerShell:
```powershell
cd server
$env:DATABASE_URL="mysql://bahlaq:ilyaselasri2005@localhost:3306/bahlaq_sap"
npx prisma db push
npx prisma db seed
```

---

## 6. Build & Deploy the Frontend

### 6a. Configure the API URL

The frontend uses `/api` as the base URL. In production, you have two options:

**Option 1 — Same domain (recommended)**: Configure your web host to reverse-proxy `/api` requests to the Koyeb backend. This keeps things simple.

**Option 2 — Different domains**: Update the API base URL in `client/src/api/client.ts`:

```ts
// Change this line:
const BASE_URL = "/api";

// To your Koyeb backend URL:
const BASE_URL = "https://bahlaq.com/api";
```

### 6b. Build the frontend

```bash
cd client
npm install
npm run build
```

This generates a `client/dist/` folder with static HTML/JS/CSS files.

### 6c. Upload to your hosting

Upload the entire contents of `client/dist/` to your web host:

- **cPanel / FTP**: Upload to `public_html/` (or a subdirectory)
- **Netlify**: Drag and drop the `dist/` folder, or connect to GitHub
  - Build command: `cd client && npm run build`
  - Publish directory: `client/dist`
- **Vercel**: Connect GitHub repo
  - Root directory: `client`
  - Build command: `npm run build`
  - Output directory: `dist`

### 6d. SPA routing configuration

Since this is a Single Page Application with client-side routing, configure your host to redirect all routes to `index.html`:

**Apache (.htaccess)**:
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

**Nginx**:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Netlify (_redirects file)**: Create `client/public/_redirects`:
```
/*    /index.html   200
```

**Vercel (vercel.json)**: Create `client/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 7. Full Docker Deployment (Alternative)

If you prefer Docker Compose (e.g., on a VPS):

```bash
# Set your production secrets
export JWT_SECRET=$(openssl rand -hex 32)
export CORS_ORIGIN=https://bahlaq.com

# Start everything
docker-compose up -d

# Push schema and seed
docker-compose exec server npx prisma db push
docker-compose exec server npx prisma db seed
```

The Dockerfile builds both frontend and backend into a single container. The backend serves on port 3001.

---

## Quick Reference

### Default Accounts (after seeding)

| Role | Email | Password | Organization |
|---|---|---|---|
| Admin | `admin@ensak.ma` | `password123` | ensak |
| Instructor | `teacher@ensak.ma` | `password123` | ensak |

Students can self-register through the sign-up form on the login page. They select the organization slug (`ensak`) and are assigned the student role automatically.

### Key Commands

```bash
# Development
npm run dev                          # Start both client + server

# Database
cd server && npx prisma db push      # Sync schema to DB
cd server && npx prisma db seed      # Seed sample data
cd server && npx prisma studio       # DB admin UI

# Build
cd client && npm run build           # Build frontend → client/dist/
cd server && npm run build           # Build backend → server/dist/

# Production (without Docker)
cd server && node dist/index.js      # Start backend
```

### MySQL Schema (auto-generated by Prisma)

You do not need to run SQL manually. `npx prisma db push` creates all tables automatically. If you want to inspect the generated SQL:

```bash
cd server
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

This outputs the full CREATE TABLE SQL without executing it.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `FATAL: JWT_SECRET environment variable must be set` | Set `JWT_SECRET` env var in production |
| `Can't reach database server` | Check `DATABASE_URL` — ensure host/port/credentials are correct |
| `Access denied for user` | Verify MySQL user has permissions: `GRANT ALL ON bahlaq_sap.* TO 'bahlaq'@'localhost'` |
| Frontend shows blank page | Check browser console. Likely missing SPA redirect — see section 6d |
| API calls fail with CORS error | Set `CORS_ORIGIN` to your exact frontend URL (no trailing slash) |
| `prisma db push` fails with timeout | Your MySQL host may block external connections. Check firewall/whitelist |
| Login says "Organization not found" | Run the seed script first, then type `ensak` in the organization field |
