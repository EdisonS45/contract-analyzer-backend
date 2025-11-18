import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("X-ADDON-SECRET");
    if (auth !== process.env.ADDON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mode } = body as { mode: string };

    console.log("Incoming mode:", mode);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    if (mode === "red_flags") {
      const { text } = body as { text: string };

      const prompt = `
You are a Senior Commercial Counsel acting as a contract risk reviewer.

Given the ENTIRE contract below, identify clauses that significantly deviate from standard commercial norms.
Focus on:
- one-way indemnity
- unlimited liability
- non-compete > 1 year
- vendor-only termination
- auto-renewal without notice
- unusual IP assignment
- overbroad confidentiality
- data ownership ambiguity

For EACH concerning clause, return a JSON object:
{
  "clause_label": "short issue title, e.g. 'One-Sided Termination for Consultant'",
  "risk_level": "RED" | "YELLOW",
  "clause_text": "exact extracted text of the clause",
  "risk_reason": "1–2 plain-English sentences explaining why this is risky for the user",
  "suggested_fix": "1–3 sentences suggesting safer wording or negotiation position"
}

ONLY return a JSON array. No commentary, no text outside JSON.

Contract:
${text}
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const output = result.response.text();
      console.log("RAW OUTPUT (red_flags):", output.slice(0, 500));

      const cleaned = output
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    }

    if (mode === "explain_clause") {
      const { clause_text } = body as { clause_text: string };

      const prompt = `
You are a Senior Commercial Counsel explaining a contract clause to a non-lawyer.

Explain the following clause in plain English, at roughly a 9th-grade reading level.
Focus on:
- what the clause does
- who it benefits
- what the main risk is for the reader

Return ONLY JSON:
{
  "explanation": "short, clear explanation in 3–6 sentences",
  "short_title": "2–6 word label, e.g. 'Termination for Convenience'"
}

Clause:
${clause_text}
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const output = result.response.text();
      console.log("RAW OUTPUT (explain_clause):", output.slice(0, 500));

      const cleaned = output
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    }

    if (mode === "suggest_rewrite") {
      const { clause_text, party } = body as {
        clause_text: string;
        party?: "Customer" | "Vendor";
      };

      const partyRole = party || "Customer";

      const prompt = `
You are a Senior Commercial Counsel negotiating on behalf of the ${partyRole}.

Given this clause, suggest a safer alternative wording that:
- reduces risk for the ${partyRole}
- remains commercially realistic
- could be reasonably accepted in negotiation

Return ONLY JSON:
{
  "suggested_clause": "rewritten clause text",
  "explanation": "2–4 sentences explaining why this version is safer / more balanced"
}

Clause:
${clause_text}
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const output = result.response.text();
      console.log("RAW OUTPUT (suggest_rewrite):", output.slice(0, 500));

      const cleaned = output
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
