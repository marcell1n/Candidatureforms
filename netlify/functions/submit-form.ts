// netlify/functions/submit-form.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import Airtable from "airtable";
import { createHash, createHmac } from "crypto";

// ---------- Helpers Cloudinary ----------

/**
 * Génère une signature pour l'upload signé Cloudinary.
 * Cloudinary exige de signer les paramètres pour sécuriser l'upload.
 */
function generateCloudinarySignature(
  params: Record<string, string>,
  apiSecret: string
): string {
  // Trier les paramètres alphabétiquement et les concaténer
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  // Créer la signature SHA-256
  return createHash("sha256")
    .update(sortedParams + apiSecret)
    .digest("hex");
}

/**
 * Upload un fichier (en base64) vers Cloudinary et retourne l'URL sécurisée.
 * On retourne aussi l'URL de prévisualisation PDF/image pour Airtable.
 */
async function uploadToCloudinary(
  fileBase64: string,
  fileName: string,
  folder: string
): Promise<{ secureUrl: string; previewUrl: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.round(Date.now() / 1000).toString();

  const params: Record<string, string> = {
    folder,
    public_id: `${folder}/${fileName}_${timestamp}`,
    timestamp,
  };

  const signature = generateCloudinarySignature(params, apiSecret);

  // Construire le FormData pour l'API Cloudinary
  const formData = new FormData();
  formData.append("file", fileBase64); // base64 avec prefix data:...
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await response.json();

  // Pour les PDFs, Cloudinary génère une image de preview avec /image/upload + .jpg
  const previewUrl = data.resource_type === "raw"
    ? data.secure_url.replace("/raw/upload/", "/image/upload/").replace(/\.[^.]+$/, ".jpg")
    : data.secure_url;

  return { secureUrl: data.secure_url, previewUrl };
}

// ---------- Handler principal ----------

const handler: Handler = async (event: HandlerEvent) => {
  // Accepter uniquement les requêtes POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Headers CORS pour que votre front puisse appeler cette fonction
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body = JSON.parse(event.body || "{}");

    const {
      nomComplet,
      email,
      telephone,
      dateNaissance,
      sexe,
      nationalite,
      domainesCompetence, // tableau de strings
      motivation,
      cvBase64,       // fichier encodé en base64
      cvName,
      diplomeBase64,
      diplomeName,
    } = body;

    // --- Upload des fichiers sur Cloudinary ---
    let cvUrl = "";
    let cvPreviewUrl = "";
    let diplomeUrl = "";
    let diplomePreviewUrl = "";

    if (cvBase64 && cvName) {
      const result = await uploadToCloudinary(cvBase64, cvName, "candidatures/cv");
      cvUrl = result.secureUrl;
      cvPreviewUrl = result.previewUrl;
    }

    if (diplomeBase64 && diplomeName) {
      const result = await uploadToCloudinary(diplomeBase64, diplomeName, "candidatures/diplomes");
      diplomeUrl = result.secureUrl;
      diplomePreviewUrl = result.previewUrl;
    }

    // --- Enregistrement dans Airtable ---
    const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    await base(process.env.AIRTABLE_TABLE_NAME!).create([
      {
        fields: {
          "Nom complet": nomComplet,
          "Email": email,
          "Téléphone": telephone,
          "Date de naissance": dateNaissance,
          "Sexe": sexe,
          "Nationalité": nationalite,
          "Domaines de compétence": Array.isArray(domainesCompetence)
            ? domainesCompetence.join(", ")
            : domainesCompetence,
          "CV": cvUrl,
          "Diplôme": diplomeUrl,
          "Motivation": motivation,
          // URLs de prévisualisation pour voir les fichiers directement dans Airtable
          "CV Preview": cvPreviewUrl,
          "Diplôme Preview": diplomePreviewUrl,
        },
      },
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Candidature envoyée avec succès !" }),
    };
  } catch (error) {
    console.error("Erreur:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Une erreur est survenue. Veuillez réessayer.",
      }),
    };
  }
};

export { handler };