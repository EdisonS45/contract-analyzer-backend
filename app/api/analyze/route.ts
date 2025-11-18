// import { NextRequest, NextResponse } from "next/server";
// import OpenAI from "openai";

// const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// //adds
// export async function POST(req: NextRequest) {
//   try {
//     const auth = req.headers.get("X-ADDON-SECRET");
//     if (auth !== process.env.ADDON_SECRET) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { text } = await req.json();

//     const prompt = `
// You are an AI legal assistant. Analyze the following contract.
// For each significant clause, return JSON with:
// - title
// - risk_score (0-10)
// - favored_party ("Vendor" | "Customer" | "Neutral")
// - explanation (1–3 sentences)

// Return JSON array only.

// Contract:
// ${text}
// `;

//     const completion = await client.chat.completions.create({
//       model: "gpt-4.1",
//       messages: [{ role: "user", content: prompt }]
//     });

//     const result = completion.choices[0].message?.content;
//     return NextResponse.json(JSON.parse(result!));
//   } catch (err: any) {
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }



import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json({ msg: "Route is working" });
}
