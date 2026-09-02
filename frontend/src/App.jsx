import React, { useState, useEffect } from "react";
import "./style.css";
import "./Dashboard.css";
import AdminPage from "./AdminPage";
import SurveyPage from "./SurveyPage";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import UsersPage from "./UsersPage";
import Dashboard from "./Dashboard";
import RespondentPage from "./RespondentPage";
import Analytics from "./Analytics";
import { translations } from "./translations";
import { supabase } from "./supabaseClient";

// ── Language switcher outside of App to avoid hook issues ──
function LangSwitcher({ lang, setLang }) {
  return (
    <div className="lang-switcher">
      <button
        className={lang === "de" ? "lang-btn lang-btn-active" : "lang-btn"}
        onClick={() => setLang("de")}
      >
        DE
      </button>
      <button
        className={lang === "en" ? "lang-btn lang-btn-active" : "lang-btn"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

// Check URL for respondent token — must be outside App to avoid re-renders
const urlToken = new URLSearchParams(window.location.search).get("token");

// Erkennen, ob die Seite über einen Einladungs-/Registrierungs-Link geöffnet wurde.
// Supabase hängt die Invite-Infos ins URL-Fragment (z. B. #access_token=...&type=invite).
const urlHash = typeof window !== "undefined" ? window.location.hash || "" : "";
const isInviteLink =
  urlHash.includes("type=invite") ||
  urlHash.includes("type=recovery") ||
  urlHash.includes("error=") ||
  urlHash.includes("error_code=") ||
  new URLSearchParams(window.location.search).get("register") === "1";

export default function App() {
  // ── ALLE Hooks zuerst, ohne return dazwischen ──
  const [lang, setLang] = useState("de");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activePage, setActivePage] = useState("admin");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showRegister, setShowRegister] = useState(isInviteLink);

  const [surveys, setSurveys] = useState([]);
  const [editor, setEditor] = useState(null);
  const [preview, setPreview] = useState(null);

  const t = translations[lang];

  const loadSurveys = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: projects }, { data: submitted }] = await Promise.all([
      supabase
        .from("projects")
        .select("*, criteria(id, label, max_value), alternatives(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("decision_makers")
        .select("project_id")
        .eq("is_submitted", true),
    ]);

    if (!projects) return;

    const submittedCount = (id) =>
      (submitted || []).filter((d) => d.project_id === id).length;

    setSurveys(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        primaryColor: "#7a003f",
        bgImage: null,
        questions: (p.criteria || []).map((c) => ({
          id: c.id,
          title: c.label,
          weightScaleMax: c.max_value,
          rows: (p.alternatives || []).map((a) => a.name),
        })),
        status: "draft",
        responses: submittedCount(p.id),
        createdAt: new Date(p.created_at).getTime(),
        updatedAt: new Date(p.created_at).getTime(),
      })),
    );
  };

  useEffect(() => {
    if (isLoggedIn) loadSurveys();
  }, [isLoggedIn]);

  const applyView = (view) => {
    setActivePage(view.activePage);
    setEditor(view.editor ?? null);
    setPreview(view.preview ?? null);
    window.history.pushState(view, "");
  };

  useEffect(() => {
    if (isLoggedIn && !editor && !preview) {
      window.history.replaceState(
        { activePage, editor: null, preview: null },
        "",
      );
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const onPopState = (e) => {
      const view = e.state || {
        activePage: "admin",
        editor: null,
        preview: null,
      };
      setActivePage(view.activePage || "admin");
      setEditor(view.editor || null);
      setPreview(view.preview || null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Check Session to let user stay logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSave = (questions, name, color, desc, bg) => {
    applyView({ activePage: "admin", editor: null, preview: null });
    loadSurveys();
  };

  // Lädt die echten Fragen (Kriterien + Alternativen) aus Supabase,
  // bevor die Vorschau geöffnet wird (die Liste in `surveys` enthält
  // nur ein Platzhalter-Array, keine echten Frage-Objekte).
  const handlePreview = async (survey) => {
    const [{ data: criteria }, { data: alternatives }] = await Promise.all([
      supabase
        .from("criteria")
        .select("id, label, max_value")
        .eq("project_id", survey.id),
      supabase.from("alternatives").select("name").eq("project_id", survey.id),
    ]);
    const rows = (alternatives || []).map((a) => a.name);
    const questions = (criteria || []).map((c) => ({
      id: c.id,
      title: c.label,
      rows,
      labels: null,
      weightScaleMax: c.max_value,
    }));
    applyView({
      activePage: "admin",
      editor: null,
      preview: { ...survey, questions },
    });
  };

  const handleDelete = async (id) => {
    await supabase.from("projects").delete().eq("id", id);
    setSurveys((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDuplicate = (id) =>
    setSurveys((prev) => {
      const orig = prev.find((s) => s.id === id);
      if (!orig) return prev;
      const now = Date.now();
      return [
        ...prev,
        {
          ...orig,
          id: makeId(),
          name: `${orig.name} (${t.copySuffix})`,
          status: "draft",
          responses: 0,
          createdAt: now,
          updatedAt: now,
        },
      ];
    });

  const handleSetStatus = (id, status) =>
    setSurveys((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status, updatedAt: Date.now() } : s,
      ),
    );

  // ── Respondent mode: show survey via token link (nach den Hooks!) ──
  if (urlToken) {
    return (
      <>
        <LangSwitcher lang={lang} setLang={setLang} />
        <RespondentPage token={urlToken} t={translations[lang]} />
      </>
    );
  }

  // ── Registrierung: eingeladene Admins setzen ihr Passwort ──
  if (showRegister) {
    return (
      <>
        <LangSwitcher lang={lang} setLang={setLang} />
        <RegisterPage
          t={t}
          onRegistered={() => {
            setShowRegister(false);
            setIsLoggedIn(true);
          }}
          onBackToLogin={async () => {
            await supabase.auth.signOut();
            setShowRegister(false);
            setIsLoggedIn(false);
          }}
        />
      </>
    );
  }
  if (!authChecked) {
    return null;
  }

  // ── Not logged in → show login page ──
  if (!isLoggedIn) {
    return (
      <>
        <LangSwitcher lang={lang} setLang={setLang} />
        <LoginPage
          onLogin={() => setIsLoggedIn(true)}
          onShowRegister={() => setShowRegister(true)}
          t={t}
        />
      </>
    );
  }

  // ── Preview view (respondent-facing) ──
  if (preview) {
    return (
      <>
        <LangSwitcher lang={lang} setLang={setLang} />
        <SurveyPage
          questions={preview.questions}
          surveyName={preview.name}
          primaryColor={preview.primaryColor}
          description={preview.description}
          bgImage={preview.bgImage}
          onBack={() =>
            applyView({ activePage: "admin", editor: null, preview: null })
          }
          t={t}
        />
      </>
    );
  }

  // ── Create / edit a survey ──
  if (editor) {
    const initialSurvey =
      editor.mode === "edit" ? surveys.find((s) => s.id === editor.id) : null;
    return (
      <>
        <LangSwitcher lang={lang} setLang={setLang} />
        <div className="top-bar">
          <button
            className="nav-tab"
            onClick={() =>
              applyView({ activePage: "admin", editor: null, preview: null })
            }
          >
            ← {t.backToDashboard}
          </button>
        </div>
        <AdminPage onSave={handleSave} t={t} initialSurvey={initialSurvey} />
      </>
    );
  }

  // ── Logged-in shell: Dashboard + Users + Analytics ──
  return (
    <>
      <LangSwitcher lang={lang} setLang={setLang} />
      <div className="top-bar">
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={
              activePage === "admin" ? "nav-tab nav-tab-active" : "nav-tab"
            }
            onClick={() =>
              applyView({ activePage: "admin", editor: null, preview: null })
            }
          >
            {t.surveysTab}
          </button>
          <button
            className={
              activePage === "analytics" ? "nav-tab nav-tab-active" : "nav-tab"
            }
            onClick={() =>
              applyView({
                activePage: "analytics",
                editor: null,
                preview: null,
              })
            }
          >
            {t.analyticsTab || "Auswertung"}
          </button>
          <button
            className={
              activePage === "users" ? "nav-tab nav-tab-active" : "nav-tab"
            }
            onClick={() =>
              applyView({ activePage: "users", editor: null, preview: null })
            }
          >
            {t.usersTab}
          </button>
          <button
            className="signout-btn"
            onClick={() => setShowSignOutConfirm(true)}
          >
            {t.signOut}
          </button>
        </div>
      </div>

      {showSignOutConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p>{t.confirmSignOut}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                className="admin-btn"
                style={{ margin: 0 }}
                onClick={async () => {
                  await supabase.auth.signOut();
                  setShowSignOutConfirm(false);
                  setIsLoggedIn(false);
                }}
              >
                {t.yes}
              </button>
              <button
                className="admin-btn"
                style={{ margin: 0, background: "#888" }}
                onClick={() => setShowSignOutConfirm(false)}
              >
                {t.no}
              </button>
            </div>
          </div>
        </div>
      )}

      {activePage === "admin" && (
        <Dashboard
          surveys={surveys}
          t={t}
          lang={lang}
          onCreate={() =>
            applyView({
              activePage: "admin",
              editor: { mode: "new" },
              preview: null,
            })
          }
          onEdit={(survey) =>
            applyView({
              activePage: "admin",
              editor: { mode: "edit", id: survey.id },
              preview: null,
            })
          }
          onPreview={handlePreview}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onSetStatus={handleSetStatus}
        />
      )}
      {activePage === "analytics" && <Analytics surveys={surveys} t={t} />}
      {activePage === "users" && <UsersPage t={t} />}
    </>
  );
}
