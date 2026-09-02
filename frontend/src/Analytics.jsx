import React, { useMemo, useState, useEffect } from "react";
import { getAuthHeaders } from "./supabaseClient";

// ────────────────────────────────────────────────────────────
// Analytics / Auswertung fürs Dashboard
//
// Endpoint:
//   - GET /projects/{project_id}/analytics → everything below in one call
//     (user_scores, weights, alternatives, criteria, weighted_sums,
//     alternative_score_avg, weight_avg) — see backend/main.py's
//     get_project_analytics, which replaced 7 separate round trips.
// ────────────────────────────────────────────────────────────

const MAROON = "#7a003f";
const PIE_COLORS = [
  "#7a003f",
  "#a83267",
  "#c76b94",
  "#e0a6c0",
  "#5a002e",
  "#9c5072",
];
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Leere Auswertung - Fallback wenn noch keine Daten vorhanden
const EMPTY_RESULT = {
  responses: 0,
  completionRate: 0,
  ranking: [],
  alternativeAvg: [],
  weights: [],
  uncertainty: [],
};

function EmptyHint({ text }) {
  return (
    <p
      style={{
        textAlign: "center",
        color: "#aaa",
        fontSize: 14,
        padding: "24px 0",
      }}
    >
      {text}
    </p>
  );
}

// Selbstgebautes horizontales Balkendiagramm
function BarChart({ data, max, unit = "", color = MAROON, emptyText }) {
  if (!data.length) return <EmptyHint text={emptyText} />;
  const maxVal = max ?? Math.max(...data.map((d) => d.value ?? d.score), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d) => {
        const val = d.value ?? d.score;
        const pct = Math.round((val / maxVal) * 100);
        return (
          <div key={d.name}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#444",
                marginBottom: 4,
              }}
            >
              <span>{d.name}</span>
              <span style={{ fontWeight: "bold", color }}>
                {val}
                {unit}
              </span>
            </div>
            <div
              style={{
                background: "#f0ecf0",
                borderRadius: 6,
                height: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 6,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Selbstgebautes Tortendiagramm (SVG)
function PieChart({ data, emptyText }) {
  if (!data.length) return <EmptyHint text={emptyText} />;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cumulative = 0;
  const radius = 80,
    cx = 100,
    cy = 100;

  const slices = data.map((d, i) => {
    const startAngle = (cumulative / total) * 2 * Math.PI;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI;
    const x1 = cx + radius * Math.sin(startAngle);
    const y1 = cy - radius * Math.cos(startAngle);
    const x2 = cx + radius * Math.sin(endAngle);
    const y2 = cy - radius * Math.cos(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], ...d };
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <svg width="200" height="200" viewBox="0 0 200 200">
        {slices.map((s) => (
          <path
            key={s.name}
            d={s.path}
            fill={s.color}
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slices.map((s) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: s.color,
                display: "inline-block",
              }}
            />
            <span>{s.name}</span>
            <span style={{ color: "#888" }}>
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Rohdaten-Tabelle (Fragen als Zeilen, Gewichtung als Spalte 2, Alternativen als Spalten)
function RawDataTable({
  data,
  criteriaList,
  emptyText,
  questionLabel,
  weightLabel,
}) {
  if (!data || data.length === 0) return <EmptyHint text={emptyText} />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr style={{ background: "#f9f9f9" }}>
            <th
              style={{
                textAlign: "left",
                padding: "8px 6px",
                borderBottom: "2px solid #eee",
                minWidth: 100,
                fontWeight: "bold",
              }}
            >
              {questionLabel}
            </th>
            {/* Gewichtungen Spalte (als 2. Spalte) */}
            <th
              style={{
                textAlign: "center",
                padding: "8px 6px",
                borderBottom: "2px solid #eee",
                color: "#7a003f",
                fontWeight: "bold",
                background: "#f0ecf0",
                minWidth: 140,
              }}
            >
              {weightLabel}
            </th>
            {/* Jede Alternative ist eine Spalte */}
            {data.map((alt) => (
              <th
                key={alt.alternative}
                style={{
                  textAlign: "center",
                  padding: "8px 6px",
                  borderBottom: "2px solid #eee",
                  color: "#666",
                  fontWeight: "bold",
                  minWidth: 140,
                }}
              >
                {alt.alternative}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteriaList.map((crit, idx) => (
            <tr key={crit} style={{ borderBottom: "1px solid #f3f3f3" }}>
              {/* Frage-Name */}
              <td
                style={{
                  padding: "8px 6px",
                  fontWeight: "bold",
                  background: "#f9f9f9",
                }}
              >
                {capitalize(crit)}
              </td>

              {/* Gewichtungen für dieses Kriterium (als 2. Spalte) */}
              <td
                style={{
                  padding: "8px 6px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  color: "#7a003f",
                  fontSize: 11,
                  background: "#f0ecf0",
                  fontWeight: "bold",
                }}
              >
                {data[0] && data[0][crit.toLowerCase()]
                  ? "{" + data[0][crit.toLowerCase()].weights.join(",") + "}"
                  : "-"}
              </td>

              {/* Jede Alternative ist eine Spalte */}
              {data.map((alt) => {
                const critData = alt[crit.toLowerCase()];
                const values = critData?.values || [];
                return (
                  <td
                    key={`${crit}-${alt.alternative}`}
                    style={{
                      padding: "8px 6px",
                      textAlign: "center",
                      fontFamily: "monospace",
                      color: "#7a003f",
                      fontSize: 11,
                    }}
                  >
                    {"{" + values.join(",") + "}"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tabelle
function DataTable({ data, valueLabel, unit = "", emptyText, nameLabel }) {
  if (!data.length) return <EmptyHint text={emptyText} />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th
            style={{
              textAlign: "left",
              fontSize: 13,
              color: "#666",
              padding: "8px 6px",
              borderBottom: "2px solid #eee",
            }}
          >
            {nameLabel}
          </th>
          <th
            style={{
              textAlign: "right",
              fontSize: 13,
              color: "#666",
              padding: "8px 6px",
              borderBottom: "2px solid #eee",
            }}
          >
            {valueLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.name}>
            <td
              style={{
                fontSize: 14,
                padding: "8px 6px",
                borderBottom: "1px solid #f3f3f3",
              }}
            >
              {d.name}
            </td>
            <td
              style={{
                fontSize: 14,
                padding: "8px 6px",
                borderBottom: "1px solid #f3f3f3",
                textAlign: "right",
                fontWeight: "bold",
                color: MAROON,
              }}
            >
              {d.value ?? d.score}
              {unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Unsicherheitsspanne: pro Alternative die mögliche Score-Spanne (min–max über alle
// Entscheider-Eingaben) + wie stark einzelne Kriterien zu dieser Spanne beitragen
function UncertaintyTable({ data, emptyText, labels }) {
  if (!data.length) return <EmptyHint text={emptyText} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {data.map((alt) => (
        <div
          key={alt.name}
          style={{ border: "1px solid #eee", borderRadius: 8, padding: 16 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 10,
            }}
          >
            <strong style={{ fontSize: 15 }}>{alt.name}</strong>
            <span style={{ color: "#666", fontSize: 12 }}>
              {labels.min}: {alt.min} · {labels.max}: {alt.max} · {labels.span}:{" "}
              {alt.span}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alt.criteria.map((c) => {
              const pct = alt.span
                ? Math.round((c.reduction / alt.span) * 100)
                : 0;
              return (
                <div key={c.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "#444",
                      marginBottom: 3,
                    }}
                  >
                    <span>{c.name}</span>
                    <span style={{ fontWeight: "bold", color: MAROON }}>
                      {c.spanBefore} {"\u2192"} {c.spanAfter} (-{c.reduction},{" "}
                      {pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      background: "#f0ecf0",
                      borderRadius: 6,
                      height: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: MAROON,
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Loading-Spinner
function LoadingSpinner({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "24px", color: "#999" }}>
      <p>{text}</p>
    </div>
  );
}
// Macht den ersten Buchstaben groß (nur fürs Anzeigen, Lookup bleibt lowercase)
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Rundet auf eine Nachkommastelle für die Anzeige (gleiche Konvention wie
// die anderen Metriken, z.B. alternativeAvg / weights)
function round1(value) {
  if (value == null || Number.isNaN(value)) return value;
  return Math.round(Number(value) * 10) / 10;
}

// Escaped genau eine CSV-Zelle nach RFC 4180: quoted, wenn nötig,
// und " innerhalb der Zelle verdoppelt.
function csvEscape(value, sep) {
  const str = String(value ?? "");
  if (
    str.includes(sep) ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
// CSV Export für Rohdaten (Fragen als Zeilen, Gewichtung als Spalte 2, Alternativen als Spalten)
function exportRawDataToCSV(rawData, criteria, surveyName = "survey", tx) {
  if (!rawData || rawData.length === 0) {
    alert(tx.noRawDataAlert);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const filename = `${surveyName.replace(/\s+/g, "_")}_rawdata_${today}.csv`;

  // Semikolon als Spaltentrenner, damit die Kommas in {4,5,3,4} nicht
  // mit den Spalten kollidieren (deutsches Excel erwartet ohnehin ";").
  const SEP = ";";

  let csvContent = "";

  // Header Row: Frage | Gewichtung | Alternative A | Alternative B | ...
  const headers = [
    tx.colQuestion,
    tx.colWeight,
    ...rawData.map((alt) => alt.alternative),
  ];
  csvContent += headers.join(SEP) + "\n";

  // Data Rows (eine Zeile pro Frage/Kriterium)
  criteria.forEach((crit) => {
    const row = [capitalize(crit)];

    // Gewichtungen für dieses Kriterium (2. Spalte)
    const weights = rawData[0]?.[crit.toLowerCase()]?.weights || [];
    row.push(csvEscape(`{${weights.join(",")}}`, SEP));

    // Für jede Alternative die Bewertungen
    rawData.forEach((alt) => {
      const critData = alt[crit.toLowerCase()];
      const values = critData?.values || [];
      row.push(csvEscape(`{${values.join(",")}}`, SEP));
    });

    csvContent += row.join(SEP) + "\n";
  });

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const METRIC_EXPORT_KEYS = {
  ranking: "ranking",
  criteria: "alternativeAvg",
  weights: "weights",
  rawdata: "rawData",
  uncertainty: "uncertainty",
};

function exportMetricToJSON(metric, data, surveyName = "survey", tx) {
  const dataKey = METRIC_EXPORT_KEYS[metric] || "ranking";
  const payload = data[dataKey];

  if (!payload || payload.length === 0) {
    alert(tx.noDataAlert);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const filename = `${surveyName.replace(/\s+/g, "_")}_${metric}_${today}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Error-Meldung
function ErrorMessage({ message, prefix }) {
  return (
    <div
      style={{
        background: "#fee",
        border: "1px solid #fcc",
        borderRadius: 8,
        padding: "12px 16px",
        color: "#c33",
        fontSize: 13,
      }}
    >
      {prefix} {message}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  Funktion um Daten vom Backend zu laden                          ║
// ╚══════════════════════════════════════════════════════════════════╝

// Hilfsfunktion: holt einen Wert egal ob das Feld "value", "rating" oder "score" heißt
function pickValue(obj) {
  if (obj == null) return null;
  if (typeof obj === "number") return obj;
  return obj.value ?? obj.rating ?? obj.score ?? obj.weight ?? null;
}

async function fetchProjectResults(projectId) {
  try {
    const headers = await getAuthHeaders();
    const analytics = await fetch(
      `${API_BASE_URL}/projects/${projectId}/analytics`,
      { headers },
    ).then((r) => r.json());

    const userScoresData = { user_scores: analytics?.user_scores }; // { user_scores: [ {alternative_id, criterion_id, value, user_id?} ] }
    const weightsData = analytics?.weights; // [ {criterion_id, value, user_id?} ]  (Rohgewichte pro Person)
    const alternativesMap = analytics?.alternatives; // { "5": "Restaurant A", ... }
    const criteriaMap = analytics?.criteria; // { "2": "Essen", ... }
    const weightedSumData = { weighted_sums: analytics?.weighted_sums }; // { weighted_sums: { dm_id: { alt_id: score } } }
    const scoresAvgData = {
      alternative_score_avg: analytics?.alternative_score_avg,
    }; // { alternative_score_avg: { crit_id: value } }
    const weightsAvgData = { weight_avg: analytics?.weight_avg }; // { weight_avg: { crit_id: value } }
    const scoreRangeData = analytics?.score_range; // { alt_id: { min_score, max_score, span, criterion_impact: {...} } }

    // Namen-Lookups (mit Fallback auf ID falls kein Name da ist)
    const altName = (id) =>
      (alternativesMap && alternativesMap[String(id)]) || `Alternative ${id}`;
    const critName = (id) =>
      (criteriaMap && criteriaMap[String(id)]) || `Criterion ${id}`;

    const userScoresRaw = userScoresData?.user_scores;
    const userScores = Array.isArray(userScoresRaw) ? userScoresRaw : [];
    const rawWeights = Array.isArray(weightsData)
      ? weightsData
      : weightsData?.weights || [];

    // ── Anzahl Antworten ──
    // Fall 1: Backend liefert eine flache Liste (mit user_id/dm_id) → eindeutige Personen zählen.
    // Fall 2 (aktuell): Backend liefert { criterion_id: [wert, wert, ...] } — ein Wert pro
    // eingereichter Antwort, für jedes Kriterium gleich viele → Array-Länge = Antwortzahl.
    let responses;
    if (Array.isArray(userScoresRaw)) {
      const uniqueUsers = new Set(
        userScores
          .map((s) => s.user_id ?? s.dm_id ?? s.decision_maker_id)
          .filter((v) => v != null),
      );
      responses = uniqueUsers.size || userScores.length;
    } else {
      const counts = Object.values(userScoresRaw || {}).map((arr) =>
        Array.isArray(arr) ? arr.length : 0,
      );
      responses = counts.length ? Math.max(...counts) : 0;
    }
    const decisionMakers = analytics?.decision_makers || {
      total: 0,
      submitted: 0,
    };
    const completionRate =
      decisionMakers.total > 0
        ? Math.round((decisionMakers.submitted / decisionMakers.total) * 100)
        : 0;

    // ── Ranking aus weighted_sum ──
    // Scores über alle Entscheider pro Alternative aufsummieren
    const scoreByAlt = {};
    Object.values(weightedSumData?.weighted_sums || {}).forEach(
      (alternatives) => {
        Object.entries(alternatives || {}).forEach(([altId, score]) => {
          scoreByAlt[altId] = (scoreByAlt[altId] || 0) + Number(score || 0);
        });
      },
    );
    const ranking = Object.entries(scoreByAlt)
      .map(([altId, score]) => ({
        name: altName(altId),
        score: Math.round(score),
      }))
      .sort((a, b) => b.score - a.score);

    // ── Ø-Bewertung pro Alternative ──
    const alternativeAvg = Object.entries(
      scoresAvgData?.alternative_score_avg || {},
    )
      .map(([altId, value]) => ({
        name: altName(altId),
        value: Math.round(value * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value);

    // ── Gewichtung der Kriterien (Durchschnitt, als Float-Wert) ──
    const weightAvgObj = weightsAvgData?.weight_avg || {};
    const weights = Object.entries(weightAvgObj)
      .map(([critId, value]) => ({
        name: critName(critId),
        value: Math.round(Number(value) * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value);

    // ── ROHDATEN aufbauen (Fragen als Zeilen, Alternativen als Spalten) ──
    // Struktur die die Tabelle erwartet:
    //   [ { alternative: "Restaurant A",
    //       essen:   { values: [...], weights: [...] },
    //       service: { values: [...], weights: [...] } }, ... ]
    const rawData = buildRawData(
      userScores,
      rawWeights,
      alternativesMap,
      criteriaMap,
      altName,
      critName,
    );

    // ── Unsicherheitsspanne: wie stark tragen einzelne Kriterien zur Uneinigkeit bei ──
    const uncertainty = Object.entries(scoreRangeData || {})
      .map(([altId, info]) => ({
        name: altName(altId),
        min: round1(info.min_score),
        max: round1(info.max_score),
        span: round1(info.span),
        criteria: Object.entries(info.criterion_impact || {})
          .map(([critId, impact]) => ({
            name: critName(critId),
            reduction: round1(impact.reduction),
            spanBefore: round1(impact.span_before),
            spanAfter: round1(impact.span_after),
          }))
          .sort((a, b) => b.reduction - a.reduction),
      }))
      .sort((a, b) => b.span - a.span);

    return {
      responses,
      completionRate,
      ranking,
      alternativeAvg,
      weights,
      rawData,
      uncertainty,
    };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Baut die Rohdaten-Struktur für die Tabelle aus den flachen Backend-Listen.
function buildRawData(
  userScores,
  rawWeights,
  alternativesMap,
  criteriaMap,
  altName,
  critName,
) {
  // Alle Alternativen- und Kriterien-IDs bestimmen
  const altIds =
    alternativesMap && Object.keys(alternativesMap).length
      ? Object.keys(alternativesMap)
      : [...new Set(userScores.map((s) => String(s.alternative_id)))];
  const critIds =
    criteriaMap && Object.keys(criteriaMap).length
      ? Object.keys(criteriaMap)
      : [...new Set(userScores.map((s) => String(s.criterion_id)))];

  // Bewertungen gruppieren: values[altId][critId] = [wert, wert, ...]
  const values = {};
  userScores.forEach((s) => {
    const a = String(s.alternative_id);
    const c = String(s.criterion_id);
    const v = pickValue(s);
    if (v == null) return;
    values[a] = values[a] || {};
    values[a][c] = values[a][c] || [];
    values[a][c].push(v);
  });

  // Gewichtungen gruppieren: weightsByCrit[critId] = [gewicht, gewicht, ...]
  // (eine Gewichtung pro Kriterium pro Person, unabhängig von der Alternative)
  const weightsByCrit = {};
  (rawWeights || []).forEach((w) => {
    const c = String(w.criterion_id);
    const v = pickValue(w);
    if (v == null) return;
    weightsByCrit[c] = weightsByCrit[c] || [];
    weightsByCrit[c].push(v);
  });

  // Zusammenbauen: pro Alternative ein Objekt, pro Kriterium ein Feld
  return altIds.map((a) => {
    const row = { alternative: altName(a) };
    critIds.forEach((c) => {
      // Feldname = Kriteriumsname in Kleinbuchstaben (passt zur Tabelle)
      const key = critName(c).toLowerCase();
      row[key] = {
        values: values[a]?.[c] || [],
        weights: weightsByCrit[c] || [],
      };
    });
    return row;
  });
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  Hauptkomponente                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

export default function Analytics({ surveys, t = {} }) {
  const surveyList = surveys && surveys.length > 0 ? surveys : [];

  // Texte mit Fallback (DE) — alle Strings kommen jetzt aus translations.js
  const tx = {
    analyticsTitle: t.analyticsTitle || "Auswertung",
    analyticsSubtitle:
      t.analyticsSubtitle || "Ergebnisse der Umfrage ansehen und filtern.",
    selectSurvey: t.analyticsSelectSurvey || "Umfrage",
    metricRanking: t.metricRanking || "Ranking der Alternativen",
    metricCriteria: t.metricCriteria || "Ø-Bewertung Alternativen",
    metricWeights: t.metricWeights || "Gewichtung der Kriterien",
    metricRawData: t.metricRawData || "Rohdaten",
    metricUncertainty: t.metricUncertainty || "Unsicherheitsspanne",
    labelMin: t.analyticsLabelMin || "Min",
    labelMax: t.analyticsLabelMax || "Max",
    labelSpan: t.analyticsLabelSpan || "Spanne",
    chartBar: t.chartBar || "Balken",
    chartPie: t.chartPie || "Torte",
    chartTable: t.chartTable || "Tabelle",
    kpiResponses: t.kpiResponses || "Antworten",
    kpiCompletion: t.kpiCompletion || "Abschlussrate",
    kpiTop: t.kpiTop || "Top-Alternative",
    noData: t.noDataForSurvey || "Keine Daten fuer diese Umfrage.",
    exportCsv: t.analyticsExportCsv || "CSV export",
    exportJson: t.analyticsExportJson || "JSON export",
    loadingData: t.analyticsLoading || t.loading || "Daten werden geladen...",
    colName: t.analyticsColName || "Name",
    colQuestion: t.analyticsColQuestion || "Frage",
    colWeight: t.analyticsColWeight || "Gewichtung",
    valueLabelCriteria: t.analyticsValueCriteria || "Ø (0-5)",
    valueLabelWeight: t.analyticsValueWeight || "Gewicht",
    valueLabelScore: t.analyticsValueScore || "Score",
    unnamedSurvey:
      t.analyticsUnnamedSurvey || t.untitled || "Unbenannte Umfrage",
    loadError: t.analyticsLoadError || "Fehler beim Laden der Daten",
    errorPrefix: t.errorLoadingPrefix || "❌ Fehler beim Laden der Daten:",
    noRawDataAlert:
      t.analyticsNoRawDataAlert || "Keine Rohdaten zum Exportieren vorhanden!",
    noDataAlert:
      t.analyticsNoDataAlert || "Keine Daten zum Exportieren vorhanden!",
  };

  const [surveyId, setSurveyId] = useState(() => surveyList[0]?.id || null);
  const [metric, setMetric] = useState("ranking");
  const [chartType, setChartType] = useState("bar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(EMPTY_RESULT);

  // Lade Daten wenn surveyId sich ändert
  useEffect(() => {
    if (!surveyId) return;

    setLoading(true);
    setError(null);

    fetchProjectResults(surveyId)
      .then((results) => {
        setData(results);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || tx.loadError);
        setData(EMPTY_RESULT);
        setLoading(false);
      });
  }, [surveyId]);

  const current = useMemo(() => {
    switch (metric) {
      case "criteria":
        return {
          rows: data.alternativeAvg,
          max: 5,
          unit: "",
          valueLabel: tx.valueLabelCriteria,
        };
      case "weights":
        return {
          rows: data.weights,
          max: null,
          unit: "",
          valueLabel: tx.valueLabelWeight,
        };
      case "rawdata": {
        // Kriterium-Namen: bevorzugt aus den Rohdaten-Feldern (behält Reihenfolge),
        // sonst aus alternativeAvg als Fallback.
        let criteria;
        if (data.rawData && data.rawData.length > 0) {
          criteria = Object.keys(data.rawData[0]).filter(
            (k) => k !== "alternative",
          );
        } else {
          criteria = data.alternativeAvg?.map((c) => c.name) || [];
        }
        return { rawData: data.rawData || [], criteria, type: "rawdata" };
      }
      case "uncertainty":
        return { uncertaintyRows: data.uncertainty || [], type: "uncertainty" };
      case "ranking":
      default:
        return {
          rows: data.ranking,
          // Kein fixer Maximalwert: der Score ist eine über alle Entscheider
          // aufsummierte Gewichtung × Bewertung und hat keine feste Obergrenze
          // (hängt von Anzahl Kriterien, Entscheidern und der pro Kriterium
          // konfigurierbaren Gewichtungs-Skala ab). BarChart normalisiert bei
          // max: null selbst relativ zum größten vorhandenen Wert (wie bei
          // "weights"), sonst wären die Balken bei kleinen Scores winzig oder
          // liefen bei großen Scores über 100% hinaus.
          max: null,
          unit: "",
          valueLabel: tx.valueLabelScore,
        };
    }
  }, [
    metric,
    data,
    tx.valueLabelCriteria,
    tx.valueLabelWeight,
    tx.valueLabelScore,
  ]);

  const topAlternative = data.ranking?.[0]?.name || "-";

  return (
    <div className="dash" style={{ paddingTop: 8 }}>
      <header className="dash-head">
        <div>
          <h1 className="dash-title">{tx.analyticsTitle}</h1>
          <p className="dash-sub">{tx.analyticsSubtitle}</p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginLeft: "auto",
            alignSelf: "flex-start",
          }}
        >
          <button
            className="admin-btn"
            onClick={() => {
              const currentSurvey = surveyList.find(
                (s) => String(s.id) === String(surveyId),
              );
              const surveyName = currentSurvey?.name || tx.unnamedSurvey;
              const criteria = Object.keys(data.rawData?.[0] || {}).filter(
                (k) => k !== "alternative",
              );
              exportRawDataToCSV(data.rawData, criteria, surveyName, tx);
            }}
          >
            {tx.exportCsv}
          </button>
          <button
            className="admin-btn"
            onClick={() => {
              const currentSurvey = surveyList.find(
                (s) => String(s.id) === String(surveyId),
              );
              const surveyName = currentSurvey?.name || tx.unnamedSurvey;
              exportMetricToJSON(metric, data, surveyName, tx);
            }}
          >
            {tx.exportJson}
          </button>
        </div>
      </header>

      {/* Umfrage-Auswahl (Dropdown) */}
      {surveyList.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#666",
              marginBottom: 4,
            }}
          >
            {tx.selectSurvey}
          </label>
          <select
            className="dash-status-select"
            style={{
              width: "100%",
              maxWidth: 360,
              padding: "10px 12px",
              fontSize: 14,
            }}
            value={surveyId || ""}
            onChange={(e) => setSurveyId(e.target.value)}
          >
            {surveyList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || tx.unnamedSurvey}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error-Meldung */}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorMessage message={error} prefix={tx.errorPrefix} />
        </div>
      )}

      {/* Loading-State */}
      {loading && <LoadingSpinner text={tx.loadingData} />}

      {/* Nur anzeigen wenn keine Loading */}
      {!loading && (
        <>
          {/* KPI-Zahlen */}
          <div className="dash-stats">
            <div className="dash-stat">
              <span className="dash-stat-num">{data.responses}</span>
              <span className="dash-stat-label">{tx.kpiResponses}</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-num">{data.completionRate}%</span>
              <span className="dash-stat-label">{tx.kpiCompletion}</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-num" style={{ fontSize: 20 }}>
                {topAlternative}
              </span>
              <span className="dash-stat-label">{tx.kpiTop}</span>
            </div>
          </div>

          {/* Auswahl: welche Auswertung + welcher Diagrammtyp */}
          <div className="dash-toolbar">
            <div className="dash-filters">
              {[
                { key: "ranking", label: tx.metricRanking },
                { key: "criteria", label: tx.metricCriteria },
                { key: "weights", label: tx.metricWeights },
                { key: "uncertainty", label: tx.metricUncertainty },
                { key: "rawdata", label: tx.metricRawData },
              ].map((m) => (
                <button
                  key={m.key}
                  className={
                    metric === m.key
                      ? "dash-chip dash-chip-active"
                      : "dash-chip"
                  }
                  onClick={() => setMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="dash-filters">
              {metric !== "rawdata" &&
                metric !== "uncertainty" &&
                [
                  { key: "bar", label: tx.chartBar },
                  { key: "pie", label: tx.chartPie },
                  { key: "table", label: tx.chartTable },
                ].map((c) => (
                  <button
                    key={c.key}
                    className={
                      chartType === c.key
                        ? "dash-chip dash-chip-active"
                        : "dash-chip"
                    }
                    onClick={() => setChartType(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Diagramm-Bereich */}
          <div className="admin-card" style={{ padding: 24 }}>
            {current.type === "rawdata" ? (
              <RawDataTable
                data={current.rawData}
                criteriaList={current.criteria}
                emptyText={tx.noData}
                questionLabel={tx.colQuestion}
                weightLabel={tx.colWeight}
              />
            ) : current.type === "uncertainty" ? (
              <UncertaintyTable
                data={current.uncertaintyRows}
                emptyText={tx.noData}
                labels={{
                  min: tx.labelMin,
                  max: tx.labelMax,
                  span: tx.labelSpan,
                }}
              />
            ) : chartType === "bar" ? (
              <BarChart
                data={current.rows}
                max={current.max}
                unit={current.unit}
                emptyText={tx.noData}
              />
            ) : chartType === "pie" ? (
              <PieChart
                data={current.rows.map((d) => ({
                  name: d.name,
                  value: d.value ?? d.score,
                }))}
                emptyText={tx.noData}
              />
            ) : (
              <DataTable
                data={current.rows}
                valueLabel={current.valueLabel}
                unit={current.unit}
                emptyText={tx.noData}
                nameLabel={tx.colName}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
