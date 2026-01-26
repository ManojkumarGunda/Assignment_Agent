# Deployment Guide

This project is ready for deployment on **Vercel** (Frontend) and **Render** (Backend).

## Prerequisites

1.  **GitHub Repository**: Ensure this code is pushed to a GitHub repository.
2.  **Accounts**: You need accounts on [Vercel](https://vercel.com) and [Render](https://render.com).

## Part 1: Backend Deployment (Render)

1.  **Log in to Render Dashboard** and click **"New +"** -> **"Web Service"**.
2.  **Connect your GitHub repository**.
3.  **Configure the Service**:
    *   **Name**: `assignment-agent-backend` (or similar)
    *   **Runtime**: `Docker` (Render should auto-detect the `Dockerfile` in the `backend` folder).
    *   **Root Directory**: `backend` (Important! Tell Render the Dockerfile is inside `backend`).
    *   **Region**: Choose strictly the closest one.
    *   **Instance Type**: `Free` (or Starter).
4.  **Environment Variables**:
    *   Scroll down to "Environment Variables" and add:
        *   `GEMINI_API_KEY`: Your Gemini API Key.
        *   `DATABASE_URL`: Render provides a constrained internal DB, or you can add a "Render PostgreSQL" service and link it. If you don't add this, the app defaults to localhost which **WON'T WORK**.
        *   **Recommended**: Create a **New PostgreSQL** database on Render first, copy its `External Database URL` (or Internal if in same region), and paste it here as `DATABASE_URL`.
        *   `APP_LOG_LEVEL`: `INFO`
5.  **Click "Create Web Service"**.
6.  **Wait for Deployment**: Monitor the logs. Once it says "Live", copy the **backend URL** (e.g., `https://assignment-agent-backend.onrender.com`).

## Part 2: Frontend Deployment (Vercel)

1.  **Log in to Vercel Dashboard** and click **"Add New..."** -> **"Project"**.
2.  **Import your GitHub repository**.
3.  **Configure the Project**:
    *   **Framework Preset**: `Vite` (Should auto-detect).
    *   **Root Directory**: Click "Edit" and select `frontend`.
4.  **Environment Variables**:
    *   Expand "Environment Variables".
    *   Add `VITE_API_URL` with the value of your **Render Backend URL** (no trailing slash, e.g., `https://assignment-agent-backend.onrender.com`).
5.  **Click "Deploy"**.

## Troubleshooting

-   **Backend Errors**: Check the "Logs" tab in Render.
    -   If "Database connection failed", ensure `DATABASE_URL` is correct.
    -   If "Module not found", ensure `backend/requirements.txt` is updated.
-   **Frontend Errors**:
    -   If the app loads but data doesn't (Network Error), check the browser console. Verify `VITE_API_URL` is set correctly in Vercel.
    -   Verify the Backend is running (visit the backend URL/health in browser).

## Important Notes on Storage
This app uses `uploads/` folder for processing files. On Render's free tier, the filesystem is **ephemeral**, meaning files are deleted when the server restarts or redeploys. For a production app, you should eventually migrate to AWS S3 or Google Cloud Storage. For now, it will work for the duration of the session.
