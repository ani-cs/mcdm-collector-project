import React, { useState, useEffect } from "react";
import { supabase, getAuthHeaders } from "./supabaseClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function UsersPage({ t }) {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [dmName, setDmName] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    loadProjects();
    loadUsers();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, []);

  const loadProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name");
    if (data) setProjects(data);
  };

  // Pulls the real admin list from the backend (Supabase auth users), so
  // this reflects who can actually sign in — not just what happened to be
  // clicked in this browser tab since the page loaded.
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin-users`, {
        headers: await getAuthHeaders(),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Failed to load admins.");
      }
      setUsers(
        (result.users || []).map((u) => ({
          id: u.id,
          email: u.email,
          role: "admin",
          status: u.status,
        })),
      );
    } catch (err) {
      console.error("Error loading admins:", err.message);
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const generateLink = async () => {
    if (!selectedProject) {
      setLinkError(t.linkGenErrorSurvey);
      return;
    }
    if (!dmName.trim()) {
      setLinkError(t.linkGenErrorName);
      return;
    }
    setLinkError("");
    setLinkLoading(true);
    try {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("decision_makers")
        .insert([
          {
            name: dmName.trim(),
            project_id: parseInt(selectedProject),
            is_submitted: false,
            expires_at: expiresAt,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/?token=${data.token}`;
      setGeneratedLink(link);
      setDmName("");
    } catch (err) {
      setLinkError(t.linkGenErrorFail + err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
  };

  // ── Add new admin ──

  const addUser = async () => {
    if (!email.trim()) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/invite-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          email: email.trim(),
          redirect_to: `${window.location.origin}/set-password`,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to send invitation.");
      }

      setSuccess(`Invitation successfully sent to ${email}!`);
      setEmail("");

      loadUsers();
    } catch (err) {
      console.error("Error inviting user:", err.message);
      setError(err.message);
    }
  };

  const removeUser = async (id) => {
    if (
      !window.confirm(
        t.confirmRemoveAdmin ||
          "Remove this admin's access? This cannot be undone.",
      )
    ) {
      return;
    }
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin-users/${id}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Failed to remove admin.");
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Error removing admin:", err.message);
      setError(err.message);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{t.linkGenTitle}</h1>
        <p>{t.linkGenSubtitle}</p>
      </div>

      <div className="admin-card">
        <h2>{t.linkGenNew}</h2>

        <label>{t.linkGenSelectSurvey}</label>
        <select
          className="dash-status-select"
          style={{
            width: "100%",
            marginBottom: 12,
            padding: "8px 10px",
            fontSize: 14,
          }}
          value={selectedProject}
          onChange={(e) => {
            setSelectedProject(e.target.value);
            setGeneratedLink("");
          }}
        >
          <option value="">{t.linkGenSelectPlaceholder}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label>{t.linkGenParticipantName}</label>
        <div className="row-input-group">
          <input
            value={dmName}
            onChange={(e) => {
              setDmName(e.target.value);
              setLinkError("");
              setGeneratedLink("");
            }}
            placeholder={t.linkGenNamePlaceholder}
            onKeyDown={(e) => e.key === "Enter" && generateLink()}
            className="link-gen-placeholder"
          />
          <button
            className="add-row-btn"
            onClick={generateLink}
            disabled={linkLoading}
          >
            {linkLoading ? "..." : "+"}
          </button>
        </div>

        {linkError && <p className="error-msg">{linkError}</p>}

        {generatedLink && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "#f6f6f6",
              borderRadius: 6,
              border: "1px solid #e0e0e0",
            }}
          >
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>
              {t.linkGenLabel}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                readOnly
                value={generatedLink}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: "6px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  background: "white",
                  color: "black",
                }}
                onClick={(e) => e.target.select()}
              />
              <button className="toggle-btn" onClick={copyLink}>
                {t.linkGenCopy}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-header" style={{ marginTop: 24 }}>
        <h1>{t.userManagement}</h1>
        <p>{t.manageAdmins}</p>
      </div>

      <div className="admin-card">
        <h2>{t.inviteAdmin}</h2>
        <label>Email</label>
        <div className="row-input-group">
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="colleague@ovgu.de"
            onKeyDown={(e) => e.key === "Enter" && addUser()}
          />
          <button className="add-row-btn" onClick={addUser}>
            +
          </button>
        </div>
        {error && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}
        <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
          {t.inviteHint}
        </p>
      </div>

      <div className="admin-card">
        <h2>
          {t.admins} <span className="count">{users.length}</span>
        </h2>
        {usersLoading && (
          <p style={{ color: "#999", fontSize: 13 }}>
            {t.loading || "Loading..."}
          </p>
        )}
        {!usersLoading && users.length === 0 && (
          <p style={{ color: "#999", fontSize: 13 }}>
            {t.noAdmins || "No admins yet."}
          </p>
        )}
        {users.map((u) => (
          <div key={u.id} className="question-item">
            <div className="question-item-info">
              <strong>{u.email}</strong>
              <span className="rows-preview">
                {u.role} ·
                <span
                  style={{
                    color: u.status === "active" ? "#1e7e34" : "#e67e00",
                  }}
                >
                  {" "}
                  {u.status}
                </span>
              </span>
            </div>
            {u.id !== currentUserId && (
              <button className="delete-btn" onClick={() => removeUser(u.id)}>
                {t.remove}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
