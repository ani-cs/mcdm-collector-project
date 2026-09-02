import { useState } from "react";
import { supabase } from "./supabaseClient";
import mcdmLogo from "./assets/MCDM_logo.png";

export default function LoginPage({ onLogin, onShowRegister, t = {} }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError(t.loginFillFields || "Please fill in all fields");
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      onLogin();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo / Title */}
        <div className="login-header">
          <div className="login-logo">
            <img src={mcdmLogo} alt="MCDM" />
          </div>
          <h1>{t.loginTitle || "Admin Login"}</h1>
          <p>{t.loginSubtitle || "Sign in to manage your surveys"}</p>
        </div>

        {/* Form */}
        <div className="login-form">
          <label>{t.email || "Email"}</label>
          <input
            type="email"
            value={email}
            disabled={loading}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="admin@ovgu.de"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <label>{t.password || "Password"}</label>
          <input
            type="password"
            value={password}
            disabled={loading}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="error-msg">{error}</p>}
          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading
              ? t.loginSigningIn || "Signing in..."
              : t.loginSignIn || "Sign in →"}
          </button>

          {/* Registrieren-Bereich für eingeladene Admins */}
          <div
            className="login-register-hint"
            style={{ marginTop: 16, textAlign: "center" }}
          >
            <span style={{ fontSize: 13, color: "#666" }}>
              {t.registerPrompt || "Wurdest du als Admin eingeladen?"}
            </span>
            <button
              type="button"
              className="login-link-btn"
              onClick={onShowRegister}
              disabled={loading}
              style={{
                background: "none",
                border: "none",
                color: "#7a003f",
                fontWeight: "bold",
                cursor: "pointer",
                marginLeft: 6,
                padding: 0,
                fontSize: 13,
                textDecoration: "underline",
              }}
            >
              {t.registerLink || "Registrieren"}
            </button>
          </div>
        </div>

        <p className="login-hint">MCDM</p>
      </div>
    </div>
  );
}
