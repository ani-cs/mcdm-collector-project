from fastapi import Depends, FastAPI, Header, Request, Query, HTTPException, status
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from backend.logic import calculate_weighted_sum, calculate_score_range
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Max number of ids accepted in list-style query params (?criterion_id=1&criterion_id=2&...)
# to keep a single request from forcing an unbounded RPC call.
MAX_ID_FILTER_LENGTH = 200

@asynccontextmanager
async def lifespan(app: FastAPI):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL")
    # MUST use SUPABASE_SERVICE_ROLE_KEY for auth admin actions like invite
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY")
    supabase_client: Client = create_client(supabase_url=SUPABASE_URL, supabase_key=SUPABASE_KEY)
    app.state.supabase = supabase_client
    yield

app = FastAPI(lifespan=lifespan)

# Comma-separated list of allowed frontend origins, e.g.
#   CORS_ALLOWED_ORIGINS=http://localhost:5173,https://my-app.example.com
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.app\.github\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_id_filter_length(ids: Optional[List[int]]):
    if ids and len(ids) > MAX_ID_FILTER_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many ids in filter (max {MAX_ID_FILTER_LENGTH}).",
        )

async def get_current_user(request: Request, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1].strip()
    supabase: Client = request.app.state.supabase
    try:
        result = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = getattr(result, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user

@app.get("/projects/{project_id}/alternatives")
async def get_alternatives(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    data = supabase.table("alternatives").select("id, name").eq("project_id", project_id).execute().data
    return {str(row["id"]): row["name"] for row in data}

@app.get("/projects/{project_id}/criteria")
async def get_criteria(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    data = supabase.table("criteria").select("id, label").eq("project_id", project_id).execute().data
    return {str(row["id"]): row["label"] for row in data}

@app.get("/projects/{project_id}/weights")
async def get_weights(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    return supabase.rpc("get_weight_values_by_project", {"p_id": project_id}).execute().data

@app.get("/projects/{project_id}/weights/avg")
async def get_weights_avg(project_id: int, request: Request, criterion_id: Optional[List[int]] = Query(None), user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    _check_id_filter_length(criterion_id)
    if criterion_id:
        return {"weight_avg": supabase.rpc("get_weight_avg_by_criterion", {"p_id": project_id, "c_id": criterion_id}).execute().data}

    return {"weight_avg": supabase.rpc("get_weight_avg_by_project", {"p_id": project_id}).execute().data}

@app.get("/projects/{project_id}/alternatives/score/avg")
async def get_alternative_avg_score(project_id: int, request: Request, alternative_id: Optional[List[int]] = Query(None), user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    _check_id_filter_length(alternative_id)
    if alternative_id:
        return {"alternative_score_avg": supabase.rpc("get_user_score_avg_by_alternative", {"p_id": project_id, "a_id": alternative_id}).execute().data}

    return {"alternative_score_avg": supabase.rpc("get_user_score_avg_by_project", {"p_id": project_id}).execute().data}

@app.get("/projects/{project_id}")
async def get_user_scores(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    return {"user_scores": supabase.rpc("get_user_rating_by_project", {"p_id": project_id}).execute().data}

def _weighted_sums_by_dm(dm_inputs: dict) -> dict:
    """Turn { dm_id: {"weights": {...}, "ratings": [...]} } into
    { dm_id: {alt_id: weighted_score} }."""
    weighted_sums = {}
    for dm_id, dm_data in (dm_inputs or {}).items():
        weights = {int(k): v for k, v in (dm_data["weights"] or {}).items()}
        ratings = dm_data["ratings"] or []
        weighted_sums[dm_id] = calculate_weighted_sum(weights, ratings)
    return weighted_sums

@app.get("/projects/{project_id}/weighted_sum")
async def get_weighted_sum(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase

    data = supabase.rpc("get_dm_inputs", {"p_id": project_id}).execute().data or {}
    return {"weighted_sums": _weighted_sums_by_dm(data)}

@app.get("/projects/{project_id}/score_range")
async def get_score_range(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase

    data = supabase.rpc("get_min_and_max_inputs_by_project", {"p_id": project_id}).execute().data or {}

    weights = data.get("weights") or {}
    ratings = data.get("ratings") or {}

    return calculate_score_range(
        weights={int(crit_id): value for crit_id, value in weights.items()},
        ratings=ratings
    )

# Aggregates everything the Analytics dashboard needs into a single response, so the frontend makes one request instead of seven.

@app.get("/projects/{project_id}/analytics")
async def get_project_analytics(project_id: int, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase

    def _rpc(name: str, params: dict):
        return supabase.rpc(name, params).execute().data

    def _table(name: str, columns: str):
        return (
            supabase.table(name)
            .select(columns)
            .eq("project_id", project_id)
            .execute()
            .data
        )

    user_scores = _rpc("get_user_rating_by_project", {"p_id": project_id})
    weights = _rpc("get_weight_values_by_project", {"p_id": project_id})
    alternatives_rows = _table("alternatives", "id, name")
    criteria_rows = _table("criteria", "id, label")
    dm_inputs = _rpc("get_dm_inputs", {"p_id": project_id})
    alternative_score_avg = _rpc("get_user_score_avg_by_project", {"p_id": project_id})
    weight_avg = _rpc("get_weight_avg_by_project", {"p_id": project_id})
    decision_maker_rows = _table("decision_makers", "id, is_submitted")

    min_max_data = _rpc("get_min_and_max_inputs_by_project", {"p_id": project_id}) or {}
    score_range_weights = min_max_data.get("weights") or {}
    score_range_ratings = min_max_data.get("ratings") or {}
    score_range = calculate_score_range(
        weights={int(crit_id): value for crit_id, value in score_range_weights.items()},
        ratings=score_range_ratings,
    )

    return {
        "user_scores": user_scores,
        "weights": weights,
        "alternatives": {str(row["id"]): row["name"] for row in (alternatives_rows or [])},
        "criteria": {str(row["id"]): row["label"] for row in (criteria_rows or [])},
        "weighted_sums": _weighted_sums_by_dm(dm_inputs or {}),
        "alternative_score_avg": alternative_score_avg,
        "weight_avg": weight_avg,
        "score_range": score_range,
        "decision_makers": {
            "total": len(decision_maker_rows or []),
            "submitted": sum(1 for r in (decision_maker_rows or []) if r.get("is_submitted")),
        },
    }

class InviteRequest(BaseModel):
    email: EmailStr
    redirect_to: str = "http://localhost:5173"

@app.post("/api/invite-user")
async def invite_user(payload: InviteRequest, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    try:
        response = supabase.auth.admin.invite_user_by_email(
            payload.email,
            options={"redirect_to": payload.redirect_to}
        )
        return {"status": "success", "data": response}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.get("/api/admin-users")
async def list_admin_users(request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    try:
        response = supabase.auth.admin.list_users()
        users = response if isinstance(response, list) else getattr(response, "users", [])
        return {
            "users": [
                {
                    "id": u.id,
                    "email": u.email,
                    "status": "active" if (u.user_metadata or {}).get("registration_completed") else "pending",
                }
                for u in users
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.delete("/api/admin-users/{user_id}")
async def delete_admin_user(user_id: str, request: Request, user=Depends(get_current_user)):
    supabase: Client = request.app.state.supabase
    try:
        supabase.auth.admin.delete_user(user_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
