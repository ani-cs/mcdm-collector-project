import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// ────────────────────────────────────────────────────────────
// Registrierungs-Seite für eingeladene Admins.
//
// Flow (Supabase Invite):
//   1. Admin lädt eine E-Mail ein → Supabase sendet Einladungs-Mail mit Link.
//   2. Person klickt den Link → landet hier. Supabase legt aus dem Token in
//      der URL automatisch eine (temporäre) Session an.
//   3. Person setzt NUR ihr Passwort (die E-Mail steht durch die Einladung fest).
//   4. Nach dem Speichern ist die Person eingeloggt.
//
// Hinweis fürs Team: Damit der Link hierher führt, muss in den Supabase-
// Einstellungen die "Redirect URL" auf diese Seite zeigen
// ────────────────────────────────────────────────────────────

export default function RegisterPage({ onRegistered, onBackToLogin, t = {} }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  // Beim Laden: prüfen, ob durch den Einladungs-Link eine Session da ist
  // und die eingeladene E-Mail auslesen (nur zur Anzeige).
  useEffect(() => {
    let active = true;

    async function init() {
      // Supabase verarbeitet den Token aus der URL automatisch beim Laden.
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const user = data?.session?.user;
      if (user) {
        setEmail(user.email || "");
        setSessionReady(true);
      }
      setChecking(false);
    }

    init();

    // Falls die Session erst kurz nach dem Laden ankommt (Token-Verarbeitung),
    // hören wir auch auf Auth-Änderungen.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session?.user) {
          setEmail(session.user.email || "");
          setSessionReady(true);
          setChecking(false);
        }
      },
    );

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleRegister = async () => {
    setError("");

    if (!password.trim() || !confirmPassword.trim()) {
      setError(
        t.registerFillFields || "Bitte beide Passwort-Felder ausfüllen.",
      );
      return;
    }
    if (password.length < 8) {
      setError(
        t.registerPasswordShort ||
          "Das Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(
        t.registerPasswordMismatch || "Die Passwörter stimmen nicht überein.",
      );
      return;
    }

    setLoading(true);
    // Passwort für den bereits eingeladenen (und per Token eingeloggten) Nutzer setzen.
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { registration_completed: true },
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      onRegistered && onRegistered();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo / Title */}
        <div className="login-header">
          <div className="login-logo">⬡</div>
          <h1>{t.registerTitle || "Registrierung abschließen"}</h1>
          <p>
            {t.registerSubtitle ||
              "Lege dein Passwort fest, um deinen Admin-Zugang zu aktivieren."}
          </p>
        </div>

        {/* Wird noch geprüft ob ein gültiger Einladungs-Link vorliegt */}
        {checking && (
          <p className="login-hint" style={{ textAlign: "center" }}>
            {t.registerChecking || "Einladung wird geprüft..."}
          </p>
        )}

        {/* Kein gültiger Einladungs-Link / keine Session */}
        {!checking && !sessionReady && (
          <div className="login-form">
            <p className="error-msg">
              {t.registerNoInvite || "Kein gültiger Einladungs-Link gefunden."}
            </p>
            <button className="login-btn" onClick={onBackToLogin}>
              {t.backToLogin || "Zurück zur Anmeldung"}
            </button>
          </div>
        )}

        {/* Gültige Einladung → Passwort setzen */}
        {!checking && sessionReady && (
          <div className="login-form">
            <label>{t.email || "Email"}</label>
            <input type="email" value={email} disabled readOnly />

            <label>{t.registerPassword || "Passwort"}</label>
            <input
              type="password"
              value={password}
              disabled={loading}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />

            <label>{t.registerConfirmPassword || "Passwort bestätigen"}</label>
            <input
              type="password"
              value={confirmPassword}
              disabled={loading}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />

            {error && <p className="error-msg">{error}</p>}

            <button
              className="login-btn"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading
                ? t.registerSaving || "Wird gespeichert..."
                : t.registerSubmit || "Registrierung abschließen"}
            </button>

            <button
              className="login-btn"
              style={{ background: "#888", marginTop: 8 }}
              onClick={onBackToLogin}
              disabled={loading}
            >
              {t.backToLogin || "Zurück zur Anmeldung"}
            </button>
          </div>
        )}

        <p className="login-hint">MCDM</p>
      </div>
    </div>
  );
}
