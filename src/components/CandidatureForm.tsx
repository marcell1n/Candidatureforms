// src/components/CandidatureForm.tsx
import { useState, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";

const NATIONALITES = [
  "Béninoise", "Burkinabè", "Camerounaise", "Congolaise",
  "Ivoirienne", "Malienne", "Nigérienne", "Sénégalaise",
  "Togolaise", "Française", "Autre"
];

const DOMAINES = [
  "Informatique / Développement",
  "Design / UX-UI",
  "Marketing / Communication",
  "Finance / Comptabilité",
  "Gestion de projet",
  "Droit / Juridique",
  "Santé / Médecine",
  "Éducation / Formation",
  "Agriculture / Agroalimentaire",
  "Autre"
];

interface FormData {
  nomComplet: string;
  email: string;
  telephone: string;
  dateNaissance: string;
  sexe: string;
  nationalite: string;
  domainesCompetence: string[];
  motivation: string;
  cv: File | null;
  diplome: File | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.6rem 0.75rem",
  marginTop: 4,
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: "1rem",
  boxSizing: "border-box",
};

const FORM_INITIAL_STATE: FormData = {
  nomComplet: "",
  email: "",
  telephone: "",
  dateNaissance: "",
  sexe: "",
  nationalite: "",
  domainesCompetence: [],
  motivation: "",
  cv: null,
  diplome: null,
};

export default function CandidatureForm() {
  // Refs pour réinitialiser les inputs file (non contrôlés par React)
  const cvInputRef = useRef<HTMLInputElement>(null);
  const diplomeInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>(FORM_INITIAL_STATE);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCheckbox = (e: ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      domainesCompetence: checked
        ? [...prev.domainesCompetence, value]
        : prev.domainesCompetence.filter((d) => d !== value),
    }));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (file && file.size > 4 * 1024 * 1024) {
      alert(
        `Le fichier "${file.name}" est trop lourd (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 4 Mo.`
      );
      e.target.value = "";
      return;
    }

    setFormData((prev) => ({ ...prev, [e.target.name]: file }));
  };

  const resetForm = () => {
    // Réinitialiser le state React
    setFormData(FORM_INITIAL_STATE);
    // Réinitialiser les inputs file HTML (ils ne sont pas contrôlés par React)
    if (cvInputRef.current) cvInputRef.current.value = "";
    if (diplomeInputRef.current) diplomeInputRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      let cvBase64 = "";
      let cvName = "";
      let diplomeBase64 = "";
      let diplomeName = "";

      if (formData.cv) {
        cvBase64 = await fileToBase64(formData.cv);
        cvName = formData.cv.name;
      }
      if (formData.diplome) {
        diplomeBase64 = await fileToBase64(formData.diplome);
        diplomeName = formData.diplome.name;
      }

      const response = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomComplet: formData.nomComplet,
          email: formData.email,
          telephone: formData.telephone,
          dateNaissance: formData.dateNaissance,
          sexe: formData.sexe,
          nationalite: formData.nationalite,
          domainesCompetence: formData.domainesCompetence,
          motivation: formData.motivation,
          cvBase64,
          cvName,
          diplomeBase64,
          diplomeName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus("success");
        setMessage(result.message);
        resetForm(); // ← vide tous les champs y compris les fichiers
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    } catch {
      setStatus("error");
      setMessage("Erreur réseau. Vérifiez votre connexion et réessayez.");
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Formulaire de candidature</h1>

      {status === "success" && (
        <div style={{
          background: "#e6f4ea", border: "1px solid #34a853",
          borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", color: "#1e4620"
        }}>
          ✓ {message}
        </div>
      )}
      {status === "error" && (
        <div style={{
          background: "#fce8e6", border: "1px solid #ea4335",
          borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", color: "#5c1010"
        }}>
          ✗ {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        <div>
          <label htmlFor="nomComplet">Nom complet *</label>
          <input id="nomComplet" name="nomComplet" type="text" required
            value={formData.nomComplet} onChange={handleChange} style={inputStyle} />
        </div>

        <div>
          <label htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required
            value={formData.email} onChange={handleChange} style={inputStyle} />
        </div>

        <div>
          <label htmlFor="telephone">Téléphone *</label>
          <input id="telephone" name="telephone" type="tel" required
            value={formData.telephone} onChange={handleChange} style={inputStyle} />
        </div>

        <div>
          <label htmlFor="dateNaissance">Date de naissance *</label>
          <input id="dateNaissance" name="dateNaissance" type="date" required
            value={formData.dateNaissance} onChange={handleChange} style={inputStyle} />
        </div>

        <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem" }}>
          <legend>Sexe *</legend>
          {["Homme", "Femme", "Autre"].map((s) => (
            <label key={s} style={{ marginRight: "1.5rem", cursor: "pointer" }}>
              <input type="radio" name="sexe" value={s} required
                checked={formData.sexe === s} onChange={handleChange}
                style={{ marginRight: 6 }} />
              {s}
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="nationalite">Nationalité *</label>
          <select id="nationalite" name="nationalite" required
            value={formData.nationalite} onChange={handleChange} style={inputStyle}>
            <option value="">-- Sélectionner --</option>
            {NATIONALITES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem" }}>
          <legend>Domaines de compétence *</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {DOMAINES.map((d) => (
              <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" value={d}
                  checked={formData.domainesCompetence.includes(d)}
                  onChange={handleCheckbox} />
                {d}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="cv">CV (PDF, max 4 Mo) *</label>
          <input
            ref={cvInputRef}
            id="cv" name="cv" type="file" required
            accept=".pdf,.doc,.docx"
            onChange={handleFile}
            style={{ display: "block", marginTop: 4 }}
          />
          {formData.cv && (
            <small style={{ color: "#555" }}>Sélectionné : {formData.cv.name}</small>
          )}
        </div>

        <div>
          <label htmlFor="diplome">Diplôme (PDF, max 4 Mo) *</label>
          <input
            ref={diplomeInputRef}
            id="diplome" name="diplome" type="file" required
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFile}
            style={{ display: "block", marginTop: 4 }}
          />
          {formData.diplome && (
            <small style={{ color: "#555" }}>Sélectionné : {formData.diplome.name}</small>
          )}
        </div>

        <div>
          <label htmlFor="motivation">Lettre de motivation *</label>
          <textarea id="motivation" name="motivation" required rows={6}
            value={formData.motivation} onChange={handleChange}
            placeholder="Expliquez votre motivation en quelques lignes..."
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            padding: "0.85rem 2rem",
            background: status === "loading" ? "#aaa" : "#1a56db",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          {status === "loading" ? "Envoi en cours..." : "Envoyer ma candidature"}
        </button>
      </form>
    </div>
  );
}