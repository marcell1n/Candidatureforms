import { setDefaultResultOrder } from "dns";
setDefaultResultOrder("ipv4first");

import { Handler, HandlerEvent } from "@netlify/functions";
import * as https from "https";

async function uploadToCloudinary(
  fileBase64: string,
  folder: string
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

  const boundary = `----FormBoundary${Date.now()}`;
  const CRLF = "\r\n";

  const addField = (name: string, value: string): string =>
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

  let bodyStr = "";
  bodyStr += addField("file", fileBase64);
  bodyStr += addField("upload_preset", "candidatures_public"); // preset non signé
  bodyStr += addField("folder", folder);
  bodyStr += `--${boundary}--${CRLF}`;

  const bodyBuffer = Buffer.from(bodyStr, "utf-8");

  const responseData = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.cloudinary.com",
        path: `/v1_1/${cloudName}/raw/upload`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": bodyBuffer.length,
        },
        family: 4,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });

  const data = JSON.parse(responseData);
  console.log("Cloudinary response:", JSON.stringify(data, null, 2));

  if (data.error) {
    throw new Error(`Cloudinary error: ${data.error.message}`);
  }

  return data.secure_url;
}

type AirtableValue = string | { url: string }[];
type AirtableFields = Record<string, AirtableValue>;

async function saveToAirtable(fields: AirtableFields): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN!;
  const baseId = process.env.AIRTABLE_BASE_ID!;
  const tableName = process.env.AIRTABLE_TABLE_NAME!;

  const payload = JSON.stringify({ records: [{ fields }] });

  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.airtable.com",
        path: `/v0/${baseId}/${encodeURIComponent(tableName)}`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        family: 4,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(
              new Error(
                `Airtable error: ${parsed.error.message} (${parsed.error.type})`
              )
            );
          } else {
            resolve();
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body = JSON.parse(event.body || "{}");
    // Ajoutez ces lignes juste après
console.log("=== Données reçues ===");
console.log("cvName:", body.cvName);
console.log("cvBase64 présent:", !!body.cvBase64);
console.log("cvBase64 longueur:", body.cvBase64?.length || 0);
console.log("diplomeName:", body.diplomeName);
console.log("diplomeBase64 présent:", !!body.diplomeBase64)

    const {
      nomComplet,
      email,
      telephone,
      dateNaissance,
      sexe,
      nationalite,
      domainesCompetence,
      motivation,
      cvBase64,
      cvName,
      diplomeBase64,
      diplomeName,
    } = body;

    let cvUrl = "";
    let diplomeUrl = "";

    if (cvBase64 && cvName) {
      cvUrl = await uploadToCloudinary(cvBase64, "candidatures/cv");
      console.log("CV URL:", cvUrl);
    }

    if (diplomeBase64 && diplomeName) {
      diplomeUrl = await uploadToCloudinary(diplomeBase64, "candidatures/diplomes");
      console.log("Diplome URL:", diplomeUrl);
    }

    await saveToAirtable({
      "Nom complet": nomComplet,
      "Email": email,
      "Telephone": telephone,
      "Date de naissance": dateNaissance,
      "Sexe": sexe,
      "Nationalite": nationalite,
      "domainesCompetence": Array.isArray(domainesCompetence)
        ? domainesCompetence.join(", ")
        : domainesCompetence,
      "CV": cvUrl ? [{ url: cvUrl }] : [],
      "Diplome": diplomeUrl ? [{ url: diplomeUrl }] : [],
      "Motivation": motivation,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Candidature envoyée avec succès !",
      }),
    };
  } catch (error) {
    console.error("Erreur:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: (error as Error).message,
      }),
    };
  }
};

export { handler };