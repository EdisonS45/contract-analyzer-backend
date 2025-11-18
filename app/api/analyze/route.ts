import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai"; // 1. Import GoogleGenAI

// 2. Initialize the Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Define the expected JSON structure for the Gemini API to enforce strict output
const contractRiskSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      clause_label: {
        type: "string",
        description: "A short title for the clause.",
      },
      risk_level: {
        type: "string",
        enum: ["RED", "YELLOW"],
        description: "Risk severity.",
      },
      clause_text: {
        type: "string",
        description: "The exact extracted text of the clause.",
      },
      risk_reason: {
        type: "string",
        description: "1–2 sentence explanation in plain English.",
      },
      suggested_fix: {
        type: "string",
        description: "1–2 sentence suggested safer version to propose.",
      },
    },
    required: [
      "clause_label",
      "risk_level",
      "clause_text",
      "risk_reason",
      "suggested_fix",
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("X-ADDON-SECRET");
    if (auth !== process.env.ADDON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mode, text } = await req.json();

    if (mode !== "red_flags") {
      return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
    }

    // 3. Define the prompt instructions (System Instruction)
    const systemInstruction = `
      You are a Senior Commercial Counsel acting as a risk reviewer for a commercial contract. 
      Goal: protect the user from atypical liability and one-sided terms.
      
      Given the ENTIRE contract text below, identify clauses that significantly deviate from normal commercial contracting standards such as:
      - One-way indemnity
      - Unlimited liability
      - Excessive non-compete
      - Vendor termination without cause
      - Hidden auto-renewal without notice
      - Unusual IP assignment
      - Overbroad confidentiality
      
      For each risky clause you identify, return the following JSON object:
      {
        "clause_label": "short title",
        "risk_level": "RED" | "YELLOW",
        "clause_text": "exact extracted text of the clause",
        "risk_reason": "1–2 sentence explanation in plain English",
        "suggested_fix": "1–2 sentence suggested safer version the user could propose"
      }
      
      Return ONLY a JSON array. No commentary.
    `;

    // 4. Call the Gemini API's generateContent method
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Contract: ${text}`, // User content: The contract text
      config: {
        systemInstruction: systemInstruction, // System prompt for the persona
        responseMimeType: "application/json", // Enforce JSON output format
        responseSchema: contractRiskSchema, // Enforce the structure of the JSON
      },
    });

    const result = response.text;
    if (!result) {
      return NextResponse.json(
        { error: "API returned no content or an empty response." },
        { status: 500 }
      );
    }

    return NextResponse.json(JSON.parse(result));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
