# Regency Salma Backend

This is the Express / Prisma backend for the Regency Salma platform.

## Local Startup Sequence

Follow these exact steps to start the backend locally:

### 1. Environment Variables
Copy `.env.example` to `.env` (if provided), or create `.env` in the `backend` directory with at least the following:

\`\`\`env
# Database connection string (PostgreSQL or SQLite)
DATABASE_URL="file:./dev.db"

# Secret for JWT signing
JWT_SECRET="local-dev-secret-key-12345"

# Comma-separated list of allowed origins for production CORS
# CORS_ALLOWED_ORIGINS="https://regencysalma.com,https://app.regencysalma.com"
\`\`\`

### 2. Database Prerequisites
Ensure your database server is running (if using PostgreSQL). If using SQLite (`file:./dev.db`), it will be created automatically.

### 3. Migrations & Seeding
Push the schema to the database and seed it with initial roles, units, and test users:
\`\`\`bash
npx prisma db push
npm run seed
\`\`\`

### 4. Start the Server
Run the backend in development mode (with hot-reloading):
\`\`\`bash
npm run dev
\`\`\`
Or build and start for production:
\`\`\`bash
npm run build
npm start
\`\`\`

### 5. Health Verification
Once the server says "Server running on port 3000", verify connectivity by visiting the health check route:
\`\`\`bash
curl http://localhost:3000/health
\`\`\`
You should receive a JSON response confirming database connectivity:
\`\`\`json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-23T00:00:00.000Z"
}
\`\`\`
