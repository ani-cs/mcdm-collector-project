# mcdm-collector

A web-based tool for collecting group inputs for **Multi-Criteria Decision Making (MCDM)**, specifically designed for cost-utility analyses.

Admins can create and manage surveys with custom criteria, publish them to respondents, and view aggregated results through a dashboard.

## Team Project

A university project developed collaboratively by a team of three students.

## My Contribution

* Supabase integration and frontend–backend communication
* Frontend development, including individual features and a page
* API integration, including unique invite-link generation and expiration handling
* Validation, error handling, and bug fixes
* Docker setup and environment configuration

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Quickstart](#setup--quickstart)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Available Services](#available-services)
- [Tech Stack](#tech-stack)

---

## Features

- **Survey builder**: Create and configure multi-criteria surveys with custom questions
- **Admin dashboard**: Manage surveys and view analytics
- **REST API**: FastAPI backend with auto-generated Swagger documentation

---

## Architecture

```
┌─────────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│  Frontend           │──────▶│  FastAPI Backend │──────▶│  Supabase        │
│  React 19 + Vite    │       │  Python          │       │  (PostgreSQL)    │
│  Port 5173          │       │  Port 8000       │       │  local or hosted │
└─────────────────────┘       └─────────────────┘       └──────────────────┘
```

---

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js 18+](https://nodejs.org/) & npm (only needed for the local demo Supabase stack below)
- A [Supabase](https://supabase.com/) project, needed only for running against real hosted data instead of the local demo (free tier is sufficient)

---

## Setup & Quickstart

### 1. Clone the repository

```bash
git clone https://github.com/RealPummel/mcdm-collector.git
cd mcdm-collector
```

### 2. Configure environment variables

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

The example files already contain working credentials for the local demo Supabase stack below, so no Supabase account is needed to run the app. See [Environment Variables](#environment-variables) for pointing at a real Supabase project instead.

### 3. Start the local demo Supabase stack

```bash
npx supabase start
```

Spins up a local Supabase (Postgres + Auth + REST API) in Docker, seeded with a demo admin and one sample project. Runs entirely on the local machine, separate from any hosted Supabase project. First run pulls the Docker images, so it takes a few minutes.

Demo login: `admin@example.com` / `password123`

Data created or edited through the app is written to this local database, browsable at http://127.0.0.1:54323 (Supabase Studio). To stop it: `npx supabase stop` (add `--no-backup` to wipe the data too). To reset back to the seed data: `npx supabase db reset`.

### 4. Start backend and frontend

```bash
docker compose up --build
```

The frontend will be available at **http://localhost:5173** and the backend at **http://localhost:8000**.

---

## Environment Variables

`cp .env.example .env` and `cp frontend/.env.example frontend/.env` already provide working credentials for the local demo Supabase stack (step 3 above); nothing further needs to be filled in.

To use a real Supabase project instead, replace these values:

- Backend (`.env`): `SUPABASE_URL` and `SUPABASE_KEY`, found in the Supabase project settings under Data API (API URL) and API keys (Secret key).
- Frontend (`frontend/.env`): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, found in the Supabase project settings under Data API (API URL) and API keys (Publishable key).

---

## API Endpoints

Full interactive API documentation is available at **http://localhost:8000/docs** (Swagger UI) once the backend is running.

---

## Available Services

| Service     | URL                        | Description                   |
| ----------- | -------------------------- | ----------------------------- |
| Backend API | http://localhost:8000      | FastAPI REST API              |
| Swagger UI  | http://localhost:8000/docs | Interactive API documentation |
| Frontend    | http://localhost:5173      | React frontend (via Vite)     |
| Supabase Studio | http://127.0.0.1:54323 | Local Supabase dashboard, while `npx supabase start` is running |

---

## Tech Stack

**Backend**

- [FastAPI](https://fastapi.tiangolo.com/): REST framework

**Frontend**

- [React 19](https://react.dev/): UI framework
- [Vite](https://vitejs.dev/): build tool and dev server

**Database**

- [Supabase](https://supabase.com/): Postgres, Auth, and REST API, run locally for development or hosted for production
