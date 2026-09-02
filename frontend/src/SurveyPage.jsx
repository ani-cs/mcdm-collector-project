import React, { useState } from "react";

// Anklickbare Sterne-Skala. `max` bestimmt, wie viele Sterne erscheinen.
function StarRating({ value, onChange, max = 5, color = "#7a003f" }) {
  const [hover, setHover] = useState(0);
  return (
    <div
      role="radiogroup"
      aria-label="Gewichtung"
      style={{
        display: "flex",
        gap: 6,
        marginTop: 8,
        justifyContent: "center",
      }}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const active = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "Stern" : "Sterne"}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 30,
              lineHeight: 1,
              padding: 0,
              color: active ? color : "#d8d3da",
              transition: "color 0.12s, transform 0.12s",
              transform: active ? "scale(1.05)" : "scale(1)",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default function SurveyPage({
  questions,
  surveyName,
  primaryColor,
  description,
  bgImage,
  onBack,
  t,
}) {
  const [answers, setAnswers] = useState({});
  // Gewichte pro Frage (in der Vorschau anklickbar)
  const [weights, setWeights] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSelect = (questionId, row, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], [row]: value },
    }));
  };

  const handleWeight = (questionId, value) => {
    setWeights((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    console.log("answers:", answers);
    console.log("weights:", weights);
    setSubmitted(true);
  };

  const currentQuestion = questions?.[currentIndex];
  const progress = questions?.length
    ? Math.round(((currentIndex + 1) / questions.length) * 100)
    : 0;

  // Absicherung: keine Fragen vorhanden (z.B. leere Vorschau)
  if (!questions || questions.length === 0 || !currentQuestion) {
    return (
      <div className="survey-container">
        <button onClick={onBack} style={{ background: "none", border: "none", color: primaryColor, cursor: "pointer", marginBottom: 8, fontSize: 14 }}>
          {t.back}
        </button>
        <div className="survey-header" style={{ borderTopColor: primaryColor, textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "#666" }}>
            {t.noQuestions || "Für diese Umfrage sind noch keine Fragen angelegt."}
          </p>
        </div>
      </div>
    );
  }

  // Anzahl Sterne aus der Frage; Standard 5, falls nicht gesetzt
  const starMax = currentQuestion?.weightScaleMax || 5;
  const currentWeight = weights[currentQuestion?.id] || 0;

  if (submitted) {
    return (
      <div className="survey-container">
        <div
          className="survey-header"
          style={{
            borderTopColor: primaryColor,
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16, color: primaryColor }}>
            ✓
          </div>
          <h1 style={{ color: primaryColor }}>{t.thankyou}</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>{t.saved}</p>
          <button
            onClick={onBack}
            style={{
              marginTop: 24,
              background: primaryColor,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 28px",
              fontSize: 15,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {t.backToDashboard || t.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="survey-container"
      style={
        bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
              minHeight: "100vh",
              padding: "20px",
              maxWidth: "100%",
              margin: "0 auto",
              boxSizing: "border-box",
            }
          : {}
      }
    >
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: primaryColor,
          cursor: "pointer",
          marginBottom: 8,
          fontSize: 14,
        }}
      >
        {t.back}
      </button>

      <div className="survey-header" style={{ borderTopColor: primaryColor }}>
        <h1 style={{ color: primaryColor }}>{surveyName || "Survey"}</h1>
        {description && (
          <p style={{ color: "#666", margin: "8px 0 0", fontSize: 14 }}>
            {description}
          </p>
        )}
      </div>

      <div className="progress-container">
        <div className="progress-info">
          <span>
            Question {currentIndex + 1} {t.questionOf} {questions.length}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%`, background: primaryColor }}
          />
        </div>
      </div>

      {/* Gewichtungsfrage mit Sternen (Anzahl je Frage) */}
      <div className="question-card">
        <h2>{t.weightQuestion || "Wie wichtig ist dir dieser Punkt?"}</h2>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 4px" }}>
          {t.weightIntro ||
            "Wähle, wie wichtig dir dieser Punkt bei deiner Entscheidung ist. Klicke auf die Sterne — 1 Stern bedeutet wenig wichtig, mehr Sterne bedeuten sehr wichtig."}
        </p>
        <p className="legend criteria">{currentQuestion.title}</p>
        <StarRating
          value={currentWeight}
          onChange={(v) => handleWeight(currentQuestion.id, v)}
          max={starMax}
          color={primaryColor}
        />
        {/* Beschriftung an den Enden der Skala (an Sterne-Reihe ausgerichtet) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: starMax * 36 - 6,
            margin: "4px auto 0",
          }}
        >
          <span style={{ fontSize: 12, color: "#999" }}>
            {t.weightLow || "weniger wichtig"}
          </span>
          <span style={{ fontSize: 12, color: "#999" }}>
            {t.weightHigh || "sehr wichtig"}
          </span>
        </div>
      </div>

      {/* Bewertung der Alternativen (wie bisher) */}
      <div className="question-card">
        <h2>{currentQuestion.title}</h2>
        <p className="legend">
          {currentQuestion.labels
            ? currentQuestion.labels.map((l) => l.text).join(" | ")
            : t.legendDefault}
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              {(
                currentQuestion.labels ||
                [1, 2, 3, 4, 5].map((n) => ({ value: n }))
              ).map((l) => (
                <th key={l.value}>{l.value}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentQuestion.rows.map((row) => (
              <tr key={row}>
                <td>{row}</td>
                {(
                  currentQuestion.labels ||
                  [1, 2, 3, 4, 5].map((n) => ({ value: n }))
                ).map((l) => (
                  <td key={l.value}>
                    <input
                      type="radio"
                      name={`${currentQuestion.id}-${row}`}
                      value={l.value}
                      checked={answers[currentQuestion.id]?.[row] === l.value}
                      onChange={() =>
                        handleSelect(currentQuestion.id, row, l.value)
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
            ← {t.questionOf === "von" ? "Zurück" : "Back"}
          </button>
        )}
        {currentIndex < questions.length - 1 ? (
          <button
            className="submit-btn"
            style={{ background: primaryColor }}
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            {t.next}
          </button>
        ) : (
          <button
            className="submit-btn"
            style={{ background: primaryColor }}
            onClick={onBack}
          >
            {t.back}
          </button>
        )}
      </div>
    </div>
  );
}
