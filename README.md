# mcdm-collector

A web-based tool for collecting group inputs for **Multi-Criteria Decision Making (MCDM)** — specifically designed for cost-utility analyses.

Admins can create and manage surveys with custom criteria, publish them to respondents, and view aggregated results through a dashboard.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Quickstart](#setup--quickstart)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Available Services](#available-services)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)

---

## Features

- **Survey builder** — Create and configure multi-criteria surveys with custom questions
- **Admin dashboard** — Manage surveys and view analytics
- **REST API** — FastAPI backend with auto-generated Swagger documentation

---

## Architecture

```
┌─────────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│  Frontend           │──────▶│  FastAPI Backend │──────▶│  Supabase        │
│  React 19 + Vite    │       │  Python          │       │  (PostgreSQL)    │
│  Port 5173          │       │  Port 8000       │       │  hosted          │
└─────────────────────┘       └─────────────────┘       └──────────────────┘
```

---

## Prerequisites

- [Python 3.11+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/) & npm
- A [Supabase](https://supabase.com/) project (free tier is sufficient)

---

## Setup & Quickstart

### 1. Clone the repository

```bash
git clone https://github.com/RealPummel/mcdm-collector.git
cd mcdm-collector
```

### 2. Configure environment variables

Backend:

```bash
cp .env.example .env
# Fill in your Supabase credentials (see Environment Variables below)
```

Frontend:

```bash
cp frontend/.env.example frontend/.env
# Fill in your Supabase credentials (see Environment Variables below)
```

### 3. Start backend and frontend

```bash
docker compose up --build
```

The frontend will be available at **http://localhost:5173** and the backend at **http://localhost:8000**.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

You can find your connection string in the Supabase dashboard under **Project Settings → Database → Connection string → URI**.

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

---

## Tech Stack

**Backend**

- [FastAPI](https://fastapi.tiangolo.com/) — REST framework

**Frontend**

- [React 19](https://react.dev/) — UI framework
- [Vite](https://vitejs.dev/) — build tool & dev server

**Database**

- [Supabase](https://supabase.com/) — hosted PostgreSQL
