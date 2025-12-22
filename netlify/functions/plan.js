export const handler = async (event) => {
  try {
    // Only POST
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" });
    }

    // Env var
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { ok: false, error: "Missing OPENAI_API_KEY" });
    }

    // Body
    const body = safeJson(event.body);
    const { festival, day, prompt, lineup, savedSets } = body || {};

    if (!festival?.name) {
      return json(400, { ok: false, error: "Missing festival.name" });
    }

    // STRICT JSON Schema (every object has additionalProperties:false)
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        dayPlanTitle: { type: "string" },
        schedule: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              time: { type: "string" },
              title: { type: "string" },
              details: { type: "string" }
            },
            required: ["time", "title", "details"]
          }
        },
        tips: { type: "array", items: { type: "string" } },
        arrival: {
          type: "object",
          additionalProperties: false,
          properties: {
            bestTime: { type: "string" },
            notes: { type: "array", items: { type: "string" } }
          },
          required: ["bestTime", "notes"]
        },
        foodBreaks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              time: { type: "string" },
              idea: { type: "string" }
            },
            required: ["time", "idea"]
          }
        },
        exit: {
          type: "object",
          additionalProperties: false,
          properties: {
            whenToLeave: { type: "string" },
            notes: { type: "array", items: { type: "string" } }
          },
          required: ["whenToLeave", "notes"]
        }
      },
      required: ["dayPlanTitle", "schedule", "tips", "arrival", "foodBreaks", "exit"]
    };

    const instructions = `
You are Concerto's Festival Planner.
Return ONLY valid JSON that matches the schema exactly. No markdown. No emojis. No extra keys.
Tone: concise, premium, practical.

Rules:
- If lineup is missing/empty, still produce a useful plan (arrival, pacing, food/water, exit logistics).
- If savedSets exist, prioritize them and reduce conflicts; suggest swaps when needed.
- Keep schedule scannable: 6–12 rows max.
`.trim();

    // Keep payload reasonable
    const safeFestival = {
      id: festival.id || "",
      name: festival.name || "",
      city: festival.city || "",
      state: festival.state || "",
      country: festival.country || "",
      venue: festival.venue || "",
      startDate: festival.startDate || "",
      endDate: festival.endDate || "",
      genres: Array.isArray(festival.genres) ? festival.genres.slice(0, 25) : [],
      hasCamping: !!festival.hasCamping
    };

    const safeLineup = truncateJson(lineup, 18000); // string-size cap
    const safeSaved = Array.isArray(savedSets) ? savedSets.slice(0, 250) : [];

    const payload = {
      festival: safeFestival,
      day: day || "Day 1",
      prompt: prompt || "",
      lineup: safeLineup,
      savedSets: safeSaved
    };

    // Call Responses API
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(payload) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "festival_plan",
            schema,
            strict: true
          }
        }
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json(500, { ok: false, error: t });
    }

    const data = await resp.json();

    // Extract model output
    const outText =
      data.output_text ||
      data?.output?.[0]?.content?.find?.((c) => c.type === "output_text")?.text ||
      "";

    let plan;
    try {
      plan = JSON.parse(outText);
    } catch (e) {
      return json(502, { ok: false, error: "Model did not return valid JSON", raw: outText });
    }

    return json(200, { ok: true, plan });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};

// --- helpers ---
function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  };
}

function safeJson(str) {
  try {
    return JSON.parse(str || "{}");
  } catch {
    return {};
  }
}

// Truncate JSON safely by string size, then re-parse.
// If it fails, return null rather than crashing.
function truncateJson(obj, maxChars) {
  if (!obj || typeof obj !== "object") return obj || null;
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxChars) return obj;
    const clipped = s.slice(0, maxChars);
    // If clipped JSON is invalid, just return a minimal null
    return null;
  } catch {
    return null;
  }
}
