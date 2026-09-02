import React, { useMemo, useState } from "react";

const STATUSES = ["all", "draft", "active", "closed"];

// Built-in DE/EN text so the dashboard always renders readable labels, even
// before these keys exist in translations.js. Real translations (passed via
// `t`) take precedence whenever they're present.
const STRINGS = {
  en: {
    dashboardTitle: "Surveys",
    dashboardSubtitle: "Create, manage, and publish your surveys.",
    newSurvey: "New survey",
    statTotal: "Total surveys",
    statActive: "Active",
    statResponses: "Responses",
    searchPlaceholder: "Search surveys",
    filterByStatus: "Filter by status",
    filterAll: "All",
    statusDraft: "Draft",
    statusActive: "Active",
    statusClosed: "Closed",
    untitled: "Untitled survey",
    noDescription: "No description",
    questionsLabel: "questions",
    responsesLabel: "responses",
    edit: "Edit",
    preview: "Preview",
    duplicate: "Duplicate",
    changeStatus: "Change status",
    delete: "Delete",
    cancel: "Cancel",
    confirmDeleteSurvey: "Delete this survey?",
    emptyTitle: "No surveys yet",
    emptyText: "Create your first survey to get started.",
    noResults: "No surveys match these filters.",
    sortLabel: "Sort",
    sortNewest: "Newest first",
    sortOldest: "Oldest first",
    sortNameAsc: "Name A–Z",
    sortNameDesc: "Name Z–A",
  },
  de: {
    dashboardTitle: "Umfragen",
    dashboardSubtitle: "Erstelle, verwalte und veröffentliche deine Umfragen.",
    newSurvey: "Neue Umfrage",
    statTotal: "Umfragen gesamt",
    statActive: "Aktiv",
    statResponses: "Antworten",
    searchPlaceholder: "Umfragen durchsuchen",
    filterByStatus: "Nach Status filtern",
    filterAll: "Alle",
    statusDraft: "Entwurf",
    statusActive: "Aktiv",
    statusClosed: "Geschlossen",
    untitled: "Unbenannte Umfrage",
    noDescription: "Keine Beschreibung",
    questionsLabel: "Fragen",
    responsesLabel: "Antworten",
    edit: "Bearbeiten",
    preview: "Vorschau",
    duplicate: "Duplizieren",
    changeStatus: "Status ändern",
    delete: "Löschen",
    cancel: "Abbrechen",
    confirmDeleteSurvey: "Diese Umfrage wirklich löschen?",
    emptyTitle: "Noch keine Umfragen",
    emptyText: "Lege deine erste Umfrage an, um loszulegen.",
    noResults: "Keine Umfragen für diese Filter gefunden.",
    sortLabel: "Sortieren",
    sortNewest: "Neueste zuerst",
    sortOldest: "Älteste zuerst",
    sortNameAsc: "Name A–Z",
    sortNameDesc: "Name Z–A",
  },
};

export default function Dashboard({
  surveys,
  t,
  lang,
  onCreate,
  onEdit,
  onPreview,
  onDelete,
  onSetStatus,
}) {
  // Merge: start from the language fallback, let real translations override.
  const base = STRINGS[lang === "de" ? "de" : "en"];
  const tx = { ...base };
  Object.keys(base).forEach((k) => {
    if (t && t[k] != null) tx[k] = t[k];
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dateDesc");
  const [confirmId, setConfirmId] = useState(null);

  const fmtDate = (ts) =>
    new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(ts));

  const statusLabel = (status) =>
    ({
      draft: tx.statusDraft,
      active: tx.statusActive,
      closed: tx.statusClosed,
    })[status] || status;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = surveys
      .filter((s) =>
        statusFilter === "all" ? true : s.status === statusFilter,
      )
      .filter((s) =>
        q
          ? (s.name || "").toLowerCase().includes(q) ||
            (s.description || "").toLowerCase().includes(q)
          : true,
      );

    const byName = (a, b) =>
      (a.name || "").localeCompare(b.name || "", lang, { sensitivity: "base" });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "dateAsc":
          return (a.updatedAt || 0) - (b.updatedAt || 0);
        case "nameAsc":
          return byName(a, b);
        case "nameDesc":
          return byName(b, a);
        case "dateDesc":
        default:
          return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
    });
  }, [surveys, query, statusFilter, sortBy, lang]);

  const stats = useMemo(
    () => ({
      total: surveys.length,
      active: surveys.filter((s) => s.status === "active").length,
      responses: surveys.reduce((sum, s) => sum + (s.responses || 0), 0),
    }),
    [surveys],
  );

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <h1 className="dash-title">{tx.dashboardTitle}</h1>
          <p className="dash-sub">{tx.dashboardSubtitle}</p>
        </div>
        <button className="dash-btn dash-btn-primary" onClick={onCreate}>
          <span aria-hidden="true">+</span> {tx.newSurvey}
        </button>
      </header>

      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-num">{stats.total}</span>
          <span className="dash-stat-label">{tx.statTotal}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-num">{stats.active}</span>
          <span className="dash-stat-label">{tx.statActive}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-num">{stats.responses}</span>
          <span className="dash-stat-label">{tx.statResponses}</span>
        </div>
      </div>

      <div className="dash-toolbar">
        <input
          className="dash-search"
          type="search"
          placeholder={tx.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={tx.searchPlaceholder}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            className="dash-filters"
            role="tablist"
            aria-label={tx.filterByStatus}
          >
            {STATUSES.map((st) => (
              <button
                key={st}
                role="tab"
                aria-selected={statusFilter === st}
                className={
                  statusFilter === st
                    ? "dash-chip dash-chip-active"
                    : "dash-chip"
                }
                onClick={() => setStatusFilter(st)}
              >
                {st === "all" ? tx.filterAll : statusLabel(st)}
              </button>
            ))}
          </div>
          <select
            className="dash-status-select"
            style={{ marginLeft: 0, color: "var(--muted)" }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label={tx.sortLabel}
          >
            <option value="dateDesc">{tx.sortNewest}</option>
            <option value="dateAsc">{tx.sortOldest}</option>
            <option value="nameAsc">{tx.sortNameAsc}</option>
            <option value="nameDesc">{tx.sortNameDesc}</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="dash-empty">
          {surveys.length === 0 ? (
            <>
              <p className="dash-empty-title">{tx.emptyTitle}</p>
              <p className="dash-empty-text">{tx.emptyText}</p>
              <button className="dash-btn dash-btn-primary" onClick={onCreate}>
                <span aria-hidden="true">+</span> {tx.newSurvey}
              </button>
            </>
          ) : (
            <p className="dash-empty-text">{tx.noResults}</p>
          )}
        </div>
      ) : (
        <ul className="dash-grid">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="dash-card"
              style={{ "--accent": s.primaryColor || "#7a003f" }}
            >
              <div className="dash-card-top">
                <span className={`dash-badge dash-badge-${s.status}`}>
                  {statusLabel(s.status)}
                </span>
                <span className="dash-card-date">{fmtDate(s.updatedAt)}</span>
              </div>

              <h2 className="dash-card-title">{s.name || tx.untitled}</h2>
              <p className="dash-card-desc">
                {s.description || tx.noDescription}
              </p>

              <div className="dash-card-meta">
                <span>
                  {s.questions?.length ?? 0} {tx.questionsLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {s.responses || 0} {tx.responsesLabel}
                </span>
              </div>

              {confirmId === s.id ? (
                <div className="dash-confirm">
                  <span className="dash-confirm-text">
                    {tx.confirmDeleteSurvey}
                  </span>
                  <div className="dash-confirm-actions">
                    <button
                      className="dash-btn dash-btn-danger"
                      onClick={() => {
                        onDelete(s.id);
                        setConfirmId(null);
                      }}
                    >
                      {tx.delete}
                    </button>
                    <button
                      className="dash-btn dash-btn-ghost"
                      onClick={() => setConfirmId(null)}
                    >
                      {tx.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dash-card-actions">
                  <button
                    className="dash-btn dash-btn-ghost"
                    onClick={() => onEdit(s)}
                  >
                    {tx.edit}
                  </button>
                  <button
                    className="dash-btn dash-btn-ghost"
                    onClick={() => onPreview(s)}
                  >
                    {tx.preview}
                  </button>
                  <select
                    className="dash-status-select"
                    value={s.status}
                    onChange={(e) => onSetStatus(s.id, e.target.value)}
                    aria-label={tx.changeStatus}
                  >
                    <option value="draft">{tx.statusDraft}</option>
                    <option value="active">{tx.statusActive}</option>
                    <option value="closed">{tx.statusClosed}</option>
                  </select>
                  <button
                    className="dash-btn dash-btn-ghost dash-btn-danger-text"
                    onClick={() => setConfirmId(s.id)}
                  >
                    {tx.delete}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
