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
      risk_level: {
        type: SchemaType.STRING,
        format: "enum",
        enum: ["RED", "YELLOW"],
      },
      start_snippet: { type: SchemaType.STRING },
      end_snippet: { type: SchemaType.STRING },
      risk_reason: { type: SchemaType.STRING },
      suggested_fix: { type: SchemaType.STRING },
      clause_text: { type: SchemaType.STRING }
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
    if (auth !== process.env.ADDON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mode, text } = body as { mode: string; text: string };
    if (mode === "rewrite") {
      const { clause_text, role } = body; // ← use existing parsed body here

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const prompt = `
You are Senior Commercial Counsel representing the **${
        role || "Service Provider"
      }**.
Your job is to propose a "negotiated compromise" rewrite that:
- Preserves most of the original clause wording
- Removes unfair or one-sided terms against the ${role}
- Looks reasonable enough for the counterparty to accept
- Makes only the minimum necessary wording changes

INPUT CLAUSE:
"${clause_text}"

Return JSON only:
{
  "suggested_clause": "full revised clause as a single block of text",
  "explanation": "the negotiation reasoning behind your change"
}
`;

      const result = await model.generateContent(prompt);
      const cleaned = result.response
        .text()
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      return NextResponse.json(JSON.parse(cleaned));
    }

    if (mode !== "red_flags") {
      return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const prompt = `
You are an elite Senior Commercial Counsel whose job is to protect the **Consultant (Service Provider)** in commercial contracts.

Analyze the full contract text below. Identify up to **5 clauses** that represent the **highest risk exposure** for the CONSULTANT.

Focus on:
• One-way indemnity
• Unlimited liability
• One-sided termination
• Auto-renewal without notice
• IP ownership transfer of background IP
• Overbroad confidentiality
• Data ownership restrictions

Return ONLY JSON in this format:
[
  {
    "clause_label": "short title",
    "risk_level": "RED" | "YELLOW",
    "start_snippet": "first 8–12 words of the risky clause as they appear",
    "end_snippet": "last 8–12 words of the same clause as they appear",
    "clause_text": "full exact text of the clause, verbatim as it appears in the document",
    "risk_reason": "professional explanation of why this harms the Consultant",
    "suggested_fix": "professional, realistic negotiation language that protects the Consultant"
  }
]

STRICT RULES:
• "start_snippet" and "end_snippet" MUST be verbatim text from the document.
• DO NOT rewrite the clause.
• DO NOT invent legal concepts not present in the text.
• Tone: professional, objective, concise.

Contract:
${text}
`;

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const parsed = JSON.parse(response.response.text());
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
