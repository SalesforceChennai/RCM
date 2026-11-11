# Healthcare RCM System (React + Vite + TypeScript + Express + PostgreSQL)

A complete Healthcare Revenue Cycle Management (RCM) application featuring an intelligent frontend and a Node.js + Express + TypeScript backend connected to a local PostgreSQL 18 database.

---

## 🗄️ PostgreSQL Database Configuration

### 1. Database Details
* **Database Name:** `rcm_database`
* **Host:** `localhost`
* **Port:** `5432`
* **User:** `postgres`
* **Connection String Format:**
  ```env
  DATABASE_URL=postgresql://postgres:<PASSWORD>@localhost:5432/rcm_database
  ```

---

## ⚙️ Environment Configuration (`.env`)

The project supports configuration through environment variables. Password credentials are kept out of source code.

### 1. Create `server/.env`
Create a file named `server/.env` (or copy from `server/.env.example`):

```env
PORT=5000
DATABASE_URL=postgresql://postgres:admin@localhost:5432/rcm_database
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=admin
PGDATABASE=rcm_database
JWT_SECRET=rcm_super_secure_jwt_secret_key_2026_production
JWT_EXPIRE_MINUTES=60
```
> **Note:** Replace `admin` with your local PostgreSQL password.

### 2. Root `.env` (Optional)
The root `.env` can also mirror these variables for root scripts.

---

## 🚀 Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs **both** the Express backend and the Vite frontend concurrently |
| `npm run server` | Starts only the Node.js + Express backend on `http://localhost:5000` |
| `npm run client` | Starts only the Vite frontend on `http://localhost:5173` |
| `npm run build` | Builds the React frontend for production |

---

## 🩺 Testing `/api/health`

When the backend starts, it automatically creates and verifies all 14 database tables and connection pooling.

To verify that PostgreSQL is connected:

### Using cURL:
```bash
curl http://localhost:5000/api/health
```

### Using Browser or Postman:
Navigate to:
```
http://localhost:5000/api/health
```

### Expected Response:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## 📊 Database Tables & Domain Support

The PostgreSQL integration creates the following tables based on the actual RCM domain models:

1. **`departments`** - Clinical departments (Cardiology, Orthopedics, etc.)
2. **`doctors`** - Providers, specializations, schedules
3. **`patients`** - Patient demographics, IDs, blood group, contacts
4. **`appointments`** - Scheduling, status, durations, consultation types
5. **`registrations`** - Patient check-in, emergency contacts, identification
6. **`insurance`** - Eligibility, copays, deductibles, coinsurance, verification
7. **`charges`** - Charge capture encounters, items, CPT & ICD-10 line items
8. **`medical_coding`** - Coding review, validation statuses, AI-suggested codes
9. **`claims`** - Claims registry, submission status, billing totals
10. **`payments`** - Remittance, insurance & patient payments, reference numbers
11. **`denials`** - Denial management, reason codes (CO-16, etc.), appeals
12. **`prior_authorizations`** - Authorization requests, validities, approvals
13. **`payment_predictions`** - Machine learning predictions, risk levels, probabilities
14. **`users`** - User authentication, roles, password hashes

---

## 🤖 RCM AI Assistant (LangChain SQL Agent & Voice Integration)

The RCM AI Assistant is an enterprise-grade AI interface integrated into the Healthcare RCM platform.

### Key Capabilities:
1. **Natural Language Database Analytics:**
   - "How many patients are registered?"
   - "Show today's appointments."
   - "Which claims are pending?"
   - "Show claims above 10000."
   - "Which insurance provider has the highest denial rate?"
   - "Show unpaid claims."
   - "Show patients with outstanding balance above 10000."
   - "Give me the total revenue collected this month."
2. **Context Awareness:**
   - Remembers recent patient queries (e.g. asking "Show Rahul Kumar's claims" followed by "How much does he owe?").
3. **Controlled Action Tools & Confirmation:**
   - Any database mutation (creating an appointment, recording payment) requires explicit user confirmation via an interactive `[Confirm]` / `[Cancel]` card before execution.
4. **Module Navigation:**
   - Commands like "Go to Medical Coding" or "Open Patients" navigate directly to the target module.
5. **Voice Support:**
   - Speech-to-Text via Web Speech API (`SpeechRecognition`).
   - Text-to-Speech via Web SpeechSynthesis (`Speak response 🔊` and `Stop speaking 🔇`).
6. **Database Safety:**
   - Strictly enforces read-only SQL validation against destructive operations (`DROP`, `TRUNCATE`, `ALTER`, etc.).

---

## 🛡️ Data & Workflow Integrity

* **UI Preservation:** All existing sidebar modules, colors, typography, tables, and workflows remain 100% untouched.
* **Database Connection:** Reuses the existing PostgreSQL connection and `rcm_database` instance without creating secondary servers or databases.
* **Storage Resilience:** The application continues to support `localStorage` as a resilient client-side fallback cache while seamlessly utilizing PostgreSQL as the backend source of truth.
* **CORS & Proxy:** The Express backend includes CORS for Vite (`localhost:5173`), and Vite includes a reverse proxy forwarding `/api` calls directly to the Express backend.
