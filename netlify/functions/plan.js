import OpenAI from "openai";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { ok: false, error: "Missing OPENAI_API_KEY env var" });
    }

    const body = JSON.parse(event.body || "{}");
    const { festival, day, prompt, lineup, savedSets } = body || {};

    if (!festival?.name) {
      return json(400, { ok: false, error: "Missing festival.name" });
    }

    const client = new OpenAI({ apiKey });

    // ---- Schema the model MUST return
    const schema = {
      name: "festival_plan",
      schema: {
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
                details: { type: "string" },
              },
              required: ["time", "title", "details"],
            },
          },
          tips: { type: "array", items: { type: "string" } },
          arrival: {
            type: "object",
            additionalProperties: false,
            properties: {
              bestTime: { type: "string" },
              notes: { type: "array", items: { type: "string" } },
            },
            required: ["bestTime", "notes"],
          },
          foodBreaks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                time: { type: "string" },
                idea: { type: "string" },
              },
              required: ["time", "idea"],
            },
          },
          exit: {
            type: "object",
            additionalProperties: false,
            properties: {
              whenToLeave: { type: "string" },
              notes: { type: "array", items: { type: "string" } },
            },
            required: ["whenToLeave", "notes"],
          },
        },
        required: ["dayPlanTitle", "schedule", "tips", "arrival", "foodBreaks", "exit"],
      },
    };

    const instructions = `
You are Concerto's Festival Planner.
Return ONLY valid JSON matching the provided schema. No markdown. No extra keys.
Tone: concise, premium, practical. No emojis.
If lineup is missing, build a smart plan around arrival, pacing, hydration/food, and exit logistics.
If savedSets exist, prioritize them and avoid conflicts (suggest swaps).
`.trim();

    // ✅ Safe lineup: don't slice JSON strings (can corrupt)
    // Just limit depth/size by selecting only the requested day if possible.
    let lineupForDay = null;
    if (lineup && typeof lineup === "object") {
      if (day && lineup[day]) lineupForDay = { [day]: lineup[day] };
      else lineupForDay = lineup; // fallback
    }

    const userPayload = {
      festival: {
        id: festival.id || "",
        name: festival.name,
        city: festival.city || "",
        state: festival.state || "",
        country: festival.country || "",
        venue: festival.venue || "",
        startDate: festival.startDate || "",
        endDate: festival.endDate || "",
        genres: festival.genres || [],
        hasCamping: !!festival.hasCamping,
      },
      day: day || "Day 1",
      user_preferences: prompt || "",
      lineup: lineupForDay,
      savedSets: Array.isArray(savedSets) ? savedSets.slice(0, 200) : [],
    };

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(userPayload) }],
        },
      ],
      text: { format: { type: "json_schema", json_schema: schema } },
    });

    const outText =
      resp.output_text ||
      resp.output?.[0]?.content?.find?.((c) => c.type === "output_text")?.text ||
      "";

    let plan;
    try {
      plan = JSON.parse(outText);
    } catch {
      return json(502, {
        ok: false,
        error: "Model did not return valid JSON",
        raw: outText,
      });
    }

    return json(200, { ok: true, plan });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
