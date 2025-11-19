import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Schema, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const schema: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      clause_label: { type: SchemaType.STRING },
      risk_level: { type: SchemaType.STRING,format:"enum", enum: ["RED", "YELLOW"] },
      start_snippet: { type: SchemaType.STRING },
      end_snippet: { type: SchemaType.STRING },
      risk_reason: { type: SchemaType.STRING },
      suggested_fix: { type: SchemaType.STRING },
      clause_text: { type: SchemaType.STRING },
    },
    required: [
      "clause_label",
      "risk_level",
      "start_snippet",
      "end_snippet",
      "risk_reason",
      "suggested_fix",
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("X-ADDON-SECRET");
    if (auth !== process.env.ADDON_SECRET)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { mode, text, clause_text, role } = body;

    // ---- Rewrite ----
    if (mode === "rewrite") {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
You are Senior Commercial Counsel negotiating on behalf of the **${role}**.

Produce a negotiated rewrite of the clause below using **surgical edits**, minimal change, market-standard fairness.

Return JSON only:
{
  "rewritten_clause": "final clause, single block",
  "explanation": "why these specific edits protect the ${role}"
}

Clause:
"${clause_text}"
`;
      const result = await model.generateContent(prompt);
      const cleaned = result.response.text().replace(/```json|```/g, "").trim();
      return NextResponse.json(JSON.parse(cleaned));
    }

    // ---- Red Flags ----
    if (mode !== "red_flags")
      return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const prompt = `
You are elite Senior Counsel protecting the **Consultant (Service Provider)**.

Identify the 5 highest-risk clauses for the CONSULTANT.
Return ONLY JSON — no text outside the JSON.

STRICT RULES:
- start_snippet & end_snippet must be verbatim from the document.
- Do not rewrite the clause.
- Keep it professional and concise.

Contract:
${text}
`;

    const res = await model.generateContent(prompt);
    const parsed = JSON.parse(res.response.text());
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
