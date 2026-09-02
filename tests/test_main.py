from unittest.mock import MagicMock


def test_get_weights_rejects_missing_auth_header(unauthenticated_client, mock_supabase):
    response = unauthenticated_client.get("/projects/1/weights")

    assert response.status_code == 401
    mock_supabase.rpc.assert_not_called()


def test_get_weights_rejects_invalid_token(client, mock_supabase):
    mock_supabase.auth.get_user.return_value = MagicMock(user=None)

    response = client.get("/projects/1/weights")

    assert response.status_code == 401
    mock_supabase.rpc.assert_not_called()


def test_get_weights_rejects_when_token_verification_raises(client, mock_supabase):
    mock_supabase.auth.get_user.side_effect = Exception("network error")

    response = client.get("/projects/1/weights")

    assert response.status_code == 401


def test_invite_user_rejects_missing_auth_header(unauthenticated_client, mock_supabase):
    response = unauthenticated_client.post("/api/invite-user", json={"email": "x@example.com"})

    assert response.status_code == 401
    mock_supabase.auth.admin.invite_user_by_email.assert_not_called()


def test_admin_users_list_rejects_missing_auth_header(unauthenticated_client, mock_supabase):
    response = unauthenticated_client.get("/api/admin-users")

    assert response.status_code == 401


def test_get_weights(client, mock_supabase):
    mock_supabase.rpc.return_value.execute.return_value.data = [3, 5, 1]

    response = client.get("/projects/1/weights")

    assert response.status_code == 200
    assert response.json() == [3, 5, 1]

    mock_supabase.rpc.assert_called_with("get_weight_values_by_project", {"p_id": 1})


def test_weights_avg_rejects_too_many_ids(client, mock_supabase):
    query = "&".join(f"criterion_id={i}" for i in range(201))

    response = client.get(f"/projects/1/weights/avg?{query}")

    assert response.status_code == 400
    mock_supabase.rpc.assert_not_called()


def test_alternative_avg_score_rejects_too_many_ids(client, mock_supabase):
    query = "&".join(f"alternative_id={i}" for i in range(201))

    response = client.get(f"/projects/1/alternatives/score/avg?{query}")

    assert response.status_code == 400
    mock_supabase.rpc.assert_not_called()


def test_get_weighted_sum(client, mock_supabase):
    mock_supabase.rpc.return_value.execute.return_value.data = {
        "1": {
            "weights": {"1": 2.0},
            "ratings": [{"alternative_id": 10, "criterion_id": 1, "value": 3.0}],
        }
    }

    response = client.get("/projects/1/weighted_sum")

    assert response.status_code == 200
    assert response.json() == {"weighted_sums": {"1": {"10": 6.0}}}
    mock_supabase.rpc.assert_called_with("get_dm_inputs", {"p_id": 1})


def test_get_score_range(client, mock_supabase):
    mock_supabase.rpc.return_value.execute.return_value.data = {
        "weights": {"1": {"min": 2.0, "max": 5.0}},
        "ratings": {"1": {"1": {"min": 3, "max": 5}}},
    }

    response = client.get("/projects/1/score_range")

    assert response.status_code == 200
    body = response.json()
    assert body["1"]["min_score"] == 6
    assert body["1"]["max_score"] == 25


def test_get_project_analytics(client, mock_supabase):
    from unittest.mock import MagicMock

    def rpc_side_effect(name, params):
        data_by_name = {
            "get_user_rating_by_project": [{"criterion_id": 1, "value": 4}],
            "get_weight_values_by_project": [2.0],
            "get_dm_inputs": {
                "1": {
                    "weights": {"1": 2.0},
                    "ratings": [{"alternative_id": 10, "criterion_id": 1, "value": 3.0}],
                }
            },
            "get_user_score_avg_by_project": {"10": 4.2},
            "get_weight_avg_by_project": {"1": 3.1},
            "get_min_and_max_inputs_by_project": {
                "weights": {"1": {"min": 2.0, "max": 5.0}},
                "ratings": {"1": {"1": {"min": 3, "max": 5}}},
            },
        }
        mock = MagicMock()
        mock.execute.return_value.data = data_by_name[name]
        return mock

    def table_side_effect(name):
        data_by_table = {
            "alternatives": [{"id": 10, "name": "Alt A"}],
            "criteria": [{"id": 1, "label": "Crit A"}],
            "decision_makers": [
                {"id": 1, "is_submitted": True},
                {"id": 2, "is_submitted": True},
                {"id": 3, "is_submitted": False},
            ],
        }
        mock = MagicMock()
        mock.select.return_value.eq.return_value.execute.return_value.data = data_by_table[name]
        return mock

    mock_supabase.rpc.side_effect = rpc_side_effect
    mock_supabase.table.side_effect = table_side_effect

    response = client.get("/projects/1/analytics")

    assert response.status_code == 200
    body = response.json()
    assert body["alternatives"] == {"10": "Alt A"}
    assert body["criteria"] == {"1": "Crit A"}
    assert body["decision_makers"] == {"total": 3, "submitted": 2}
    assert body["weighted_sums"] == {"1": {"10": 6.0}}
    assert body["alternative_score_avg"] == {"10": 4.2}
    assert body["weight_avg"] == {"1": 3.1}
    assert body["score_range"]["1"]["min_score"] == 6
    assert body["score_range"]["1"]["max_score"] == 25


def test_invite_user_success(client, mock_supabase):
    mock_supabase.auth.admin.invite_user_by_email.return_value = {"user": {"id": "abc"}}

    response = client.post("/api/invite-user", json={"email": "new-admin@example.com"})

    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_invite_user_failure_returns_400(client, mock_supabase):
    mock_supabase.auth.admin.invite_user_by_email.side_effect = Exception("email rejected")

    response = client.post("/api/invite-user", json={"email": "new-admin@example.com"})

    assert response.status_code == 400
    assert response.json()["detail"] == "email rejected"


def test_list_admin_users(client, mock_supabase):
    class FakeUser:
        def __init__(self, id, email, registration_completed):
            self.id = id
            self.email = email
            self.user_metadata = {"registration_completed": registration_completed}

    mock_supabase.auth.admin.list_users.return_value = [
        FakeUser("1", "active@example.com", True),
        FakeUser("2", "pending@example.com", False),
    ]

    response = client.get("/api/admin-users")

    assert response.status_code == 200
    assert response.json() == {
        "users": [
            {"id": "1", "email": "active@example.com", "status": "active"},
            {"id": "2", "email": "pending@example.com", "status": "pending"},
        ]
    }


def test_delete_admin_user(client, mock_supabase):
    response = client.delete("/api/admin-users/abc123")

    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    mock_supabase.auth.admin.delete_user.assert_called_with("abc123")