import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function getCropGuide(cropName, state, city, language = "English") {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an expert agricultural advisor for India.

Crop: ${cropName}
Location: ${city}, ${state}
Language: ${language}

Respond in JSON with this exact structure (no markdown, no code blocks):
{
  "crop": "${cropName}",
  "steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "estimated_cost": "e.g. ₹15,000 – ₹20,000 per acre",
  "expected_profit": "e.g. ₹40,000 – ₹60,000 per acre",
  "time_to_harvest": "e.g. 60–90 days",
  "tips": [
    "Tip 1: ...",
    "Tip 2: ..."
  ]
}

Rules:
- steps: 4 to 6 practical steps specific to ${state} climate
- tips: 2 to 4 expert tips for higher yield or profit
- Costs and profits in Indian Rupees (INR)
- Respond in ${language}
- Return ONLY valid JSON, nothing else
`.trim();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const raw = result.response.text().trim();

  try {
    const cleaned = raw.replace(/^```json?\n?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      crop:            parsed.crop            ?? cropName,
      steps:           Array.isArray(parsed.steps) ? parsed.steps : [],
      estimated_cost:  parsed.estimated_cost  ?? "—",
      expected_profit: parsed.expected_profit ?? "—",
      time_to_harvest: parsed.time_to_harvest ?? "—",
      tips:            Array.isArray(parsed.tips)  ? parsed.tips  : [],
    };
  } catch {
    return {
      crop: cropName,
      steps: [raw],
      estimated_cost: "—",
      expected_profit: "—",
      time_to_harvest: "—",
      tips: [],
    };
  }
}

export async function getCropDetail(cropName, state, language = "English") {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an expert agricultural advisor for India.

Crop: ${cropName}
State: ${state}
Language: ${language}

Respond in JSON with this exact structure (no markdown, no code blocks):
{
  "howToGrow": "2-3 sentences on how to grow this crop",
  "estimatedCost": "estimated cost per acre in INR",
  "estimatedProfit": "estimated profit per acre in INR",
  "timeToHarvest": "days or weeks to harvest"
}

Rules:
- Be specific to ${state} climate and conditions
- Respond in ${language}
- Return ONLY valid JSON, nothing else
`.trim();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const raw = result.response.text().trim();

  try {
    const cleaned = raw.replace(/^```json?\n?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      howToGrow: raw,
      estimatedCost: "—",
      estimatedProfit: "—",
      timeToHarvest: "—",
    };
  }
}

export async function getCropForecast(state, city, language = "English") {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are an expert agricultural advisor for India.

Location: ${city}, ${state}
Timeframe: next 1–3 months
Language: ${language}

Respond in JSON with this exact structure (no markdown, no code blocks):
{
  "profitable_crops": [
    { "name": "crop name", "reason": "why it is profitable right now" }
  ],
  "low_crops": [
    { "name": "crop name", "reason": "why it is underperforming right now" }
  ]
}

Rules:
- 3 to 5 entries in profitable_crops, 2 to 3 entries in low_crops
- Base reasoning on current season, local climate of ${city} ${state}, and market demand
- Respond in ${language}
- Return ONLY valid JSON, nothing else
`.trim();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const raw = result.response.text().trim();

  try {
    const cleaned = raw.replace(/^```json?\n?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      profitable_crops: Array.isArray(parsed.profitable_crops) ? parsed.profitable_crops : [],
      low_crops:        Array.isArray(parsed.low_crops)        ? parsed.low_crops        : [],
      raw,
    };
  } catch {
    return { profitable_crops: [], low_crops: [], raw };
  }
}
