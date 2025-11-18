import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("X-ADDON-SECRET");
    if (auth !== process.env.ADDON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mode, text } = await req.json();

    console.log("Incoming mode:", mode);
    console.log("Text length:", text ? text.length : 0);

    if (mode !== "red_flags") {
      return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

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

For EACH concerning clause, return exact JSON item with:
{
  "clause_label": "short title",
  "risk_level": "RED" | "YELLOW",
  "clause_text": "exact extracted text of the clause",
  "risk_reason": "1–2 plain-English sentences explaining the danger",
  "suggested_fix": "1–2 sentences suggesting safer wording the user could propose"
}

Return ONLY a JSON array. No commentary, no explanation outside JSON.

Contract:
${text}
`;

    const result = await model.generateContent(prompt);
    const output = result.response.text();

    console.log("Raw Gemini output:", output.slice(0, 500));

    const cleaned = output
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
