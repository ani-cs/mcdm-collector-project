import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function RespondentPage({ token, t }) {
  const [status, setStatus] = useState("loading");
  const [dm, setDm] = useState(null);
  const [project, setProject] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [alternatives, setAlternatives] = useState([]);

  const [answers, setAnswers] = useState({});
  const [weights, setWeights] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSurvey();
  }, [token]);

  const loadSurvey = async () => {
    const { data: dmData, error: dmError } = await supabase
      .from("decision_makers")
      .select("*")
      .eq("token", token)
      .single();

    if (dmError || !dmData) {
      setStatus("error");
      return;
    }
    if (dmData.is_submitted) {
      setStatus("already_done");
      return;
    }
    if (dmData.expires_at && new Date(dmData.expires_at) < new Date()) {
      setStatus("expired");
      return;
    }
    setDm(dmData);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", dmData.project_id)
      .single();

    if (projectError || !projectData) {
      setStatus("error");
      return;
    }
    setProject(projectData);

    const [{ data: crit }, { data: alts }] = await Promise.all([
      supabase.from("criteria").select("*").eq("project_id", dmData.project_id),
      supabase
        .from("alternatives")
        .select("*")
        .eq("project_id", dmData.project_id),
    ]);

    setCriteria(crit || []);
    setAlternatives(alts || []);
    setStatus("ready");
  };

  const handleSelect = (criterionId, alternativeId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [criterionId]: { ...(prev[criterionId] || {}), [alternativeId]: value },
    }));
  };

  const handleWeightSelect = (criterionId, value) => {
    setWeights((prev) => ({ ...prev, [criterionId]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const ratings = [];
      for (const [criterionId, altMap] of Object.entries(answers)) {
        for (const [alternativeId, value] of Object.entries(altMap)) {
          ratings.push({
            dm_id: dm.id,
            criterion_id: parseInt(criterionId),
            alternative_id: parseInt(alternativeId),
            value: parseFloat(value),
          });
        }
      }

      if (ratings.length > 0) {
        const { error: ratingsError } = await supabase
          .from("criterion_ratings")
          .insert(ratings);
        if (ratingsError) throw ratingsError;
      }

      const weightRows = Object.entries(weights).map(
        ([criterionId, value]) => ({
          dm_id: dm.id,
          criterion_id: parseInt(criterionId),
          value: parseFloat(value),
        }),
      );

      if (weightRows.length > 0) {
        const { error: weightsError } = await supabase
          .from("criterion_weights")
          .insert(weightRows);
        if (weightsError) throw weightsError;
      }

      const { error: updateError } = await supabase
        .from("decision_makers")
        .update({ is_submitted: true })
        .eq("id", dm.id);
      if (updateError) throw updateError;

      setSubmitted(true);
    } catch (err) {
      alert("Fehler beim Speichern: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div
        className="survey-container"
        style={{ textAlign: "center", paddingTop: 80 }}
      >
        {t.loading}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="survey-container">
        <div
          className="survey-header"
          style={{
            borderTopColor: "#c00",
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16, color: "#c00" }}>✕</div>
          <h1 style={{ color: "#c00" }}>{t.linkInvalidTitle}</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>
            {t.linkInvalidText}
          </p>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="survey-container">
        <div
          className="survey-header"
          style={{
            borderTopColor: "#e67e00",
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16, color: "#e67e00" }}>
            ⏱
          </div>
          <h1 style={{ color: "#e67e00" }}>{t.linkExpiredTitle}</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>
            {t.linkExpiredText}
          </p>
        </div>
      </div>
    );
  }

  if (status === "already_done") {
    return (
      <div className="survey-container">
        <div
          className="survey-header"
          style={{
            borderTopColor: "#7a003f",
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16, color: "#7a003f" }}>
            ✓
          </div>
          <h1 style={{ color: "#7a003f" }}>{t.linkAlreadyDoneTitle}</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>
            {t.linkAlreadyDoneText}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="survey-container">
        <div
          className="survey-header"
          style={{
            borderTopColor: "#7a003f",
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16, color: "#7a003f" }}>
            ✓
          </div>
          <h1 style={{ color: "#7a003f" }}>{t.thankyou}</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>{t.saved}</p>
        </div>
      </div>
    );
  }

  const currentCriterion = criteria[currentIndex];
  const progress = Math.round(((currentIndex + 1) / criteria.length) * 100);
  const scale = [1, 2, 3, 4, 5];
  const weightMax = currentCriterion?.max_value || 5;
  const weightScale = Array.from({ length: weightMax }, (_, i) => i + 1);

  const hasWeight = !!weights[currentCriterion?.id];
  const hasAllRatings =
    alternatives.length > 0 &&
    alternatives.every(
      (alt) => answers[currentCriterion?.id]?.[alt.id] !== undefined,
    );
  const canProceed = hasWeight && hasAllRatings;

  return (
    <div className="survey-container">
      <div className="survey-header" style={{ borderTopColor: "#7a003f" }}>
        <h1 style={{ color: "#7a003f" }}>{project?.name || "Survey"}</h1>
        {project?.description && (
          <p style={{ color: "#666", margin: "8px 0 0", fontSize: 14 }}>
            {project.description}
          </p>
        )}
      </div>

      <div className="progress-container">
        <div className="progress-info">
          <span>
            {t.questionLabel} {currentIndex + 1} {t.questionOf}{" "}
            {criteria.length}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%`, background: "#7a003f" }}
          />
        </div>
      </div>

      <div className="question-card">
        <h2>{t.weightQuestion}</h2>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 4px" }}>
          {t.weightIntro}
        </p>
        <p className="legend criteria">{currentCriterion?.label}</p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          <div
            role="radiogroup"
            aria-label={t.weightQuestion}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {weightScale.map((star) => {
              const currentWeight = weights[currentCriterion?.id] || 0;
              const active = star <= currentWeight;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={currentWeight === star}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  onClick={() => handleWeightSelect(currentCriterion.id, star)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 30,
                    lineHeight: 1,
                    padding: 0,
                    color: active ? "#7a003f" : "#d8d3da",
                  }}
                >
                  ★
                </button>
              );
            })}
          </div>
          <span style={{ fontWeight: "bold", color: "#7a003f", fontSize: 14 }}>
            {weights[currentCriterion?.id] || 0} / {weightMax}
          </span>
        </div>
      </div>

      <div className="question-card">
        <h2>{currentCriterion?.label}</h2>
        <p className="legend">{t.legendDefault}</p>
        <table>
          <thead>
            <tr>
              <th></th>
              {scale.map((v) => (
                <th key={v}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alternatives.map((alt) => (
              <tr key={alt.id}>
                <td>{alt.name}</td>
                {scale.map((v) => (
                  <td key={v}>
                    <input
                      type="radio"
                      name={`${currentCriterion.id}-${alt.id}`}
                      value={v}
                      checked={answers[currentCriterion.id]?.[alt.id] === v}
                      onChange={() =>
                        handleSelect(currentCriterion.id, alt.id, v)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="nav-buttons">
        {currentIndex > 0 && (
          <button
            className="nav-btn-back"
            onClick={() => setCurrentIndex(currentIndex - 1)}
          >
            ← {t.backBtn}
          </button>
        )}
        {currentIndex < criteria.length - 1 ? (
          <button
            className="submit-btn"
            style={{ background: canProceed ? "#7a003f" : "#ccc" }}
            onClick={() => setCurrentIndex(currentIndex + 1)}
            disabled={!canProceed}
          >
            {t.next}
          </button>
        ) : (
          <button
            className="submit-btn"
            style={{ background: saving || !canProceed ? "#ccc" : "#7a003f" }}
            onClick={handleSubmit}
            disabled={saving || !canProceed}
          >
            {saving ? t.saving : t.submit}
          </button>
        )}
      </div>
    </div>
  );
}
