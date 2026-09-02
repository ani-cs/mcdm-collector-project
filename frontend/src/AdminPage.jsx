import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Default answer scale, pre-filled in the admin's current language. Once the
// admin edits a label, their text is kept (it's survey content, not UI chrome).
const defaultLabelsEN = [
  { value: 1, text: "1 - Very bad" },
  { value: 2, text: "2 - Bad" },
  { value: 3, text: "3 - Ok" },
  { value: 4, text: "4 - Good" },
  { value: 5, text: "5 - Very good" },
];

const defaultLabelsDE = [
  { value: 1, text: "1 - Sehr schlecht" },
  { value: 2, text: "2 - Schlecht" },
  { value: 3, text: "3 - Okay" },
  { value: 4, text: "4 - Gut" },
  { value: 5, text: "5 - Sehr gut" },
];

const colorOptions = [
  { label: "OVGU Purple", value: "#7a003f" },
  { label: "Blue", value: "#1a73e8" },
  { label: "Green", value: "#1e7e34" },
  { label: "Purple", value: "#6f42c1" },
  { label: "Orange", value: "#e67e00" },
];

// ── NEU: Standard-Höchstzahl für die Gewichts-Sterne ──
const DEFAULT_WEIGHT_MAX = 5;

export default function AdminPage({ onSave, t }) {
  // Detect language from an existing key (t.rows is "Zeilen" in German), so the
  // scale and the new labels stay correct even before translations.js is updated.
  const isGerman = t.rows === "Zeilen";
  const defaultLabels = isGerman ? defaultLabelsDE : defaultLabelsEN;

  const [questions, setQuestions] = useState([]);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState([]);
  const [rowInput, setRowInput] = useState("");
  const [surveyName, setSurveyName] = useState("");
  const [labels, setLabels] = useState(defaultLabels);
  const [showScaleEditor, setShowScaleEditor] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#7a003f");
  const [errors, setErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false); //setlaoding state

  // ── NEU: Anzahl Sterne (Gewichts-Skala) für die nächste Frage ──
  const [weightMax, setWeightMax] = useState(DEFAULT_WEIGHT_MAX);

  const addRow = () => {
    const trimmedInput = rowInput.trim();

    if (!trimmedInput) return;

    const isDuplicate = rows.some(
      (r) => r.toLowerCase() === trimmedInput.toLowerCase(),
    );

    if (isDuplicate) {
      setErrors({ ...errors, rows: t.errorDuplicateRow });
      return;
    }
    setErrors({});
    setRows([...rows, rowInput.trim()]);
    setRowInput("");
  };

  const deleteRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  // Clear the carried-over rows when the next question needs a different list.
  const clearRows = () => {
    setRows([]);
    setRowInput("");
  };

  const addQuestion = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = t.errorTitle;
    if (rows.length === 0) newErrors.rows = t.errorRows;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    //check for duplicate quetsions
    const isDuplicate = questions.some(
      (q) => q.title.trim().toLowerCase() === title.trim().toLowerCase(),
    );
    if (isDuplicate) newErrors.title = t.errorDuplicateQ;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    // Store a copy of rows so each question keeps its own list…
    // ── NEU: weightScaleMax pro Frage mitspeichern ──
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        title,
        rows: [...rows],
        labels: [...labels],
        weightScaleMax: weightMax,
      },
    ]);
    // …and keep `rows` as-is so the next question inherits them. Only the
    // title is cleared. Use "Clear rows" to start a fresh list.
    setTitle("");
    setRowInput("");
  };

  const confirmDelete = (id) => setDeleteConfirm(id);

  const deleteQuestion = () => {
    setQuestions(questions.filter((q) => q.id !== deleteConfirm));
    setDeleteConfirm(null);
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setEditTitle(q.title);
  };

  const saveEdit = (id) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, title: editTitle } : q)),
    );
    setEditingId(null);
  };

  // ── NEU: Sternzahl einer bereits angelegten Frage ändern ──
  const updateQuestionWeightMax = (id, value) => {
    const n = Math.max(2, Math.min(10, parseInt(value) || DEFAULT_WEIGHT_MAX));
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, weightScaleMax: n } : q)),
    );
  };

  const moveQuestion = (index, direction) => {
    const newQuestions = [...questions];
    const target = index + direction;
    if (target < 0 || target >= newQuestions.length) return;
    [newQuestions[index], newQuestions[target]] = [
      newQuestions[target],
      newQuestions[index],
    ];
    setQuestions(newQuestions);
  };

  const updateLabel = (index, newText) => {
    setLabels(
      labels.map((l, i) => (i === index ? { ...l, text: newText } : l)),
    );
  };

  const addScaleOption = () => {
    const nextValue = labels.length + 1;
    setLabels([...labels, { value: nextValue, text: `${nextValue} - ` }]);
  };

  const removeScaleOption = (index) => {
    if (labels.length <= 2) return;
    setLabels(
      labels
        .filter((_, i) => i !== index)
        .map((l, i) => ({ ...l, value: i + 1 })),
    );
  };

  const resetLabels = () => setLabels(defaultLabels);

  // If the admin switches language while the scale is still untouched (equal to
  // one of the default sets), swap it to the new language's default. A scale the
  // admin has customized is left alone.
  useEffect(() => {
    const matchesDefault = (a, b) =>
      a.length === b.length && a.every((l, i) => l.text === b[i].text);
    setLabels((prev) =>
      matchesDefault(prev, defaultLabelsEN) ||
      matchesDefault(prev, defaultLabelsDE)
        ? defaultLabels
        : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGerman]);

  const handleSave = async () => {
    const newErrors = {};
    if (!surveyName.trim()) newErrors.surveyName = t.errorName;
    if (questions.length === 0) newErrors.questions = t.errorQuestions;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      //saves in 'projects' table
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Authorization failed");

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .insert([
          { name: surveyName, description: description, admin_id: user.id },
        ])
        .select()
        .single();
      if (projectError) throw projectError;

      const genProjectId = projectData.id; //take generated id

      //for each question, save in 'criteria' Table, check for duplicates

      const uniqueQuestions = Array.from(
        new Map(questions.map((q) => [q.title, q])).values(),
      );

      for (const q of uniqueQuestions) {
        const { error: criteriaError } = await supabase
          .from("criteria")
          .insert([
            {
              label: q.title,
              project_id: genProjectId,
              max_value: q.weightScaleMax || DEFAULT_WEIGHT_MAX,
            },
          ]);
        if (criteriaError) throw criteriaError;
      }

      //'alternatives' table
      const allAlternatives = questions.flatMap((q) => q.rows);
      const uniqueAlternatives = [...new Set(allAlternatives)].map((name) => ({
        name: name,
        project_id: genProjectId,
      }));

      if (uniqueAlternatives.length > 0) {
        const { error: alternativesError } = await supabase
          .from("alternatives")
          .insert(uniqueAlternatives);
        if (alternativesError) throw alternativesError;
      }

      onSave(questions, surveyName, primaryColor, description, null);
    } catch (error) {
      console.error("Supabase insertion error", error);
      alert("error detected: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Language-correct fallbacks for the few new strings — used only until the
  // matching keys live in translations.js.
  const clearRowsLabel =
    t.clearRows || (isGerman ? "Zeilen leeren" : "Clear rows");
  const rowsReusedLabel =
    t.rowsReused ||
    (isGerman
      ? "Diese Zeilen werden für die nächste Frage übernommen — du kannst sie anpassen."
      : "These rows carry over to the next question — you can adjust them.");
  const saveLabel =
    t.saveSurvey || (isGerman ? "Umfrage speichern" : "Save survey");
  // ── NEU: Texte für die Gewichts-Skala ──
  const weightMaxLabel =
    t.weightMaxLabel ||
    (isGerman ? "Anzahl Sterne (Gewichtung)" : "Number of stars (weighting)");
  const weightMaxHint =
    t.weightMaxHint ||
    (isGerman
      ? "So viele Sterne sieht der/die Befragte für diese Frage."
      : "The respondent sees this many stars for this question.");

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{t.adminTitle}</h1>
        <p>{t.adminSubtitle}</p>
      </div>

      <div className="admin-card">
        <h2>{t.surveyName}</h2>
        <input
          value={surveyName}
          onChange={(e) => {
            setSurveyName(e.target.value);
            setErrors((p) => ({ ...p, surveyName: null }));
          }}
          placeholder={t.surveyNamePlaceholder}
        />
        {errors.surveyName && <p className="error-msg">{errors.surveyName}</p>}
        <label style={{ marginTop: 16 }}>{t.description}</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.descriptionPlaceholder}
        />
      </div>

      <div className="admin-card">
        <h2>{t.surveyColor}</h2>
        <div className="color-options">
          {colorOptions.map((c) => (
            <button
              key={c.value}
              className={`color-btn ${primaryColor === c.value ? "color-btn-active" : ""}`}
              style={{ background: c.value }}
              onClick={() => setPrimaryColor(c.value)}
              title={c.label}
            />
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, color: "#666", margin: 0 }}>
              {t.ownColor}
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              style={{
                width: 40,
                height: 36,
                padding: 2,
                border: "1px solid #ddd",
                borderRadius: 4,
                cursor: "pointer",
              }}
            />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="scale-header">
          <h2>
            {t.scale} <span className="count">{labels.length}</span>
          </h2>
          <button
            className="toggle-btn"
            onClick={() => setShowScaleEditor(!showScaleEditor)}
          >
            {showScaleEditor ? t.scaleClose : t.scaleEdit}
          </button>
        </div>
        {!showScaleEditor && (
          <div className="scale-preview">
            {labels.map((l) => (
              <span key={l.value} className="scale-tag">
                {l.text}
              </span>
            ))}
          </div>
        )}
        {showScaleEditor && (
          <div>
            {labels.map((l, i) => (
              <div
                key={i}
                className="row-input-group"
                style={{ marginBottom: 8 }}
              >
                <input
                  value={l.text}
                  onChange={(e) => updateLabel(i, e.target.value)}
                />
                <button
                  className="delete-scale-btn"
                  onClick={() => removeScaleOption(i)}
                  disabled={labels.length <= 2}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="scale-actions">
              <button className="add-row-btn" onClick={addScaleOption}>
                {t.addOption}
              </button>
              <button className="reset-btn" onClick={resetLabels}>
                {t.scaleReset}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2>{t.newQuestion}</h2>
        <label>{t.questionTitle}</label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((p) => ({ ...p, title: null }));
          }}
          placeholder={t.questionTitlePlaceholder}
        />
        {errors.title && <p className="error-msg">{errors.title}</p>}

        {/* ── NEU: Anzahl Sterne (Gewichts-Skala) für diese Frage ── */}
        <label style={{ marginTop: 12 }}>{weightMaxLabel}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="number"
            min={2}
            max={10}
            value={weightMax}
            onChange={(e) =>
              setWeightMax(
                Math.max(
                  2,
                  Math.min(10, parseInt(e.target.value) || DEFAULT_WEIGHT_MAX),
                ),
              )
            }
            style={{ width: 90 }}
          />
          <span style={{ color: "#7a003f", fontSize: 18, letterSpacing: 2 }}>
            {"★".repeat(weightMax)}
          </span>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          {weightMaxHint}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <label style={{ margin: 0 }}>{t.rows}</label>
          {rows.length > 0 && (
            <button
              className="toggle-btn"
              style={{ padding: "4px 10px" }}
              onClick={clearRows}
            >
              {clearRowsLabel}
            </button>
          )}
        </div>
        <div className="row-input-group">
          <input
            value={rowInput}
            onChange={(e) => setRowInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRow()}
            placeholder={t.rowsPlaceholder}
          />
          <button className="add-row-btn" onClick={addRow}>
            +
          </button>
        </div>
        {errors.rows && <p className="error-msg">{errors.rows}</p>}
        {rows.map((row, i) => (
          <div key={i} className="row-tag">
            <span>{row}</span>
            <button onClick={() => deleteRow(i)}>✕</button>
          </div>
        ))}
        {rows.length > 0 && (
          <p className="hint" style={{ marginTop: 8 }}>
            {rowsReusedLabel}
          </p>
        )}
        <button className="admin-btn" onClick={addQuestion}>
          {t.addQuestion}
        </button>
      </div>

      {questions.length > 0 && (
        <div className="admin-card">
          <h2>
            {t.questionList} <span className="count">{questions.length}</span>
          </h2>
          {errors.questions && <p className="error-msg">{errors.questions}</p>}
          {questions.map((q, i) => (
            <div key={q.id} className="question-item">
              <div className="move-btns">
                <button onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                  ▲
                </button>
                <button
                  onClick={() => moveQuestion(i, 1)}
                  disabled={i === questions.length - 1}
                >
                  ▼
                </button>
              </div>
              <div className="question-item-info">
                {editingId === q.id ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 14 }}
                    />
                    <button
                      className="toggle-btn"
                      onClick={() => saveEdit(q.id)}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <strong>
                    {i + 1}. {q.title}
                  </strong>
                )}
                <span className="rows-preview">{q.rows.join(" · ")}</span>
                {/* ── NEU: Sternzahl pro Frage anzeigen + anpassbar ── */}
                <span
                  className="rows-preview"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ color: "#7a003f" }}>
                    {"★".repeat(q.weightScaleMax || DEFAULT_WEIGHT_MAX)}
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={q.weightScaleMax || DEFAULT_WEIGHT_MAX}
                    onChange={(e) =>
                      updateQuestionWeightMax(q.id, e.target.value)
                    }
                    style={{ width: 56, padding: "2px 6px", fontSize: 13 }}
                    title={weightMaxLabel}
                  />
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="delete-btn" onClick={() => startEdit(q)}>
                  ✏️
                </button>
                <button
                  className="delete-btn"
                  onClick={() => confirmDelete(q.id)}
                >
                  {t.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p>{t.confirmDelete}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                className="delete-btn"
                onClick={() => setDeleteConfirm(null)}
              >
                {t.cancel}
              </button>
              <button className="admin-btn" onClick={deleteQuestion}>
                {t.yesDelete}
              </button>
            </div>
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            className="preview-btn"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? t.hidePreview : t.showPreview}
          </button>
          <button
            className="start-btn"
            style={{ background: primaryColor }}
            onClick={handleSave}
          >
            {saveLabel}
          </button>
        </div>
      )}

      {showPreview && (
        <div className="admin-card" style={{ marginTop: 12 }}>
          <h2>{t.preview}</h2>
          {questions.map((q, i) => (
            <div
              key={q.id}
              style={{
                marginBottom: 16,
                borderBottom: "1px solid #f0f0f0",
                paddingBottom: 16,
              }}
            >
              <strong style={{ color: primaryColor }}>
                {i + 1}. {q.title}
              </strong>
              {/* ── NEU: Gewichts-Sterne in der Vorschau anzeigen ── */}
              <p style={{ fontSize: 13, color: "#888", margin: "6px 0" }}>
                {isGerman ? "Gewichtung: " : "Weighting: "}
                <span
                  style={{
                    color: primaryColor,
                    fontSize: 16,
                    letterSpacing: 2,
                  }}
                >
                  {"★".repeat(q.weightScaleMax || DEFAULT_WEIGHT_MAX)}
                </span>
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: "4px 0 8px" }}>
                {q.labels.map((l) => l.text).join(" | ")}
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th></th>
                    {q.labels.map((l) => (
                      <th
                        key={l.value}
                        style={{
                          fontSize: 13,
                          color: "#666",
                          padding: 6,
                          textAlign: "center",
                        }}
                      >
                        {l.value}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.rows.map((row) => (
                    <tr key={row}>
                      <td style={{ fontSize: 13, padding: 6 }}>{row}</td>
                      {q.labels.map((l) => (
                        <td
                          key={l.value}
                          style={{ textAlign: "center", padding: 6 }}
                        >
                          <input
                            type="radio"
                            disabled
                            style={{ accentColor: primaryColor }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
