# 🚀 Deployment Manual

Since I cannot access your personal Vercel and Render accounts, you need to follow these exact steps to finish the deployment.

## 1. Push Your Code to GitHub (Required First)
I prepared all the files, but the GitHub Token in your `.env` file did not have permission to push code.
**Run this command in your terminal now:**

```powershell
git push -u origin main
```

*(If it asks for a username/password, use your GitHub username and your Personal Access Token, or just sign in via browser if prompted)*

---

## 2. Deploy Backend (Render.com)
The backend runs the Python/FastAPI logic.

1.  **Register/Login:** Go to [https://dashboard.render.com/](https://dashboard.render.com/)
2.  **Create Service:** Click **New +** → **Web Service**
3.  **Connect Repo:** Select `Assignment_Agent` from the list.
4.  **Configure Settings:**
    *   **Name:** `assignment-agent-backend`
    *   **Region:** (Select closest to you, e.g., Singapore or Oregon)
    *   **Root Directory:** `backend` (⚠️ Important!)
    *   **Runtime:** `Python 3`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5.  **Environment Variables:**
    Scroll down to "Environment Variables" and click "Add Environment Variable". Add exactly these from your `.env` file:
    *   `DATABASE_URL` = `postgresql://postgres:CoastalSeven%40B4@db.nfnvsguefvwoxpylibha.supabase.co:5432/postgres`
    *   `GEMINI_API_KEY` = `(Copy from your backend/.env)`
    *   `GEMINI_MODEL` = `gemini-2.5-pro`
    *   `OPENROUTER_API_KEY` = `(Copy from your backend/.env)`
    *   `GITHUB_TOKEN` = `(Copy from your backend/.env)`
6.  **Deploy:** Click **Create Web Service**.
7.  **Get URL:** Once deployed (green "Live" badge), copy the URL at the top (e.g., `https://assignment-agent-backend.onrender.com`).

---

## 3. Deploy Frontend (Vercel)
The frontend is your React website.

1.  **Register/Login:** Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2.  **Import Project:** Click **Add New...** → **Project**
3.  **Select Repo:** Import `Assignment_Agent`.
4.  **Configure Project:**
    *   **Root Directory:** Click "Edit" and select `frontend`. (⚠️ Important!)
    *   **Framework Preset:** It should say `Vite` automatically.
5.  **Environment Variables:**
    *   Click "Environment Variables".
    *   **Key:** `VITE_API_URL`
    *   **Value:** (Paste your Render Backend URL here, e.g., `https://assignment-agent-backend.onrender.com`)
    *   *Note: Do not add a slash `/` at the very end.*
6.  **Deploy:** Click **Deploy**.

---

## 4. Final Validation
1.  Open your new Vercel URL.
2.  The app should load.
3.  Try uploading a file or running a test to ensure it talks to the Render backend.
