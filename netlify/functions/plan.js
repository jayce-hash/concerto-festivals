export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Missing OPENAI_API_KEY" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { festival, day, prompt, lineup, savedSets } = body || {};

    if (!festival?.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing festival.name" }),
      };
    }

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
              properties: {
                time: { type: "string" },
                idea: { type: "string" },
              },
              required: ["time", "idea"],
            },
          },
          exit: {
            type: "object",
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
Return ONLY valid JSON matching the provided schema.
No markdown. No emojis. No extra keys.
Tone: concise, premium, practical.
If lineup is missing, still give a smart arrival + pacing + exit plan.
If savedSets exist, prioritize them and avoid conflicts.
`.trim();

    const payload = {
      festival,
      day,
      prompt,
      lineup,
      savedSets,
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: JSON.stringify(payload) }
            ],
          },
        ],
        text: {
  format: {
    type: "json_schema",
    name: "festival_plan",
    schema: schema.schema,
    strict: true
  }
},
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: t }),
      };
    }

    const data = await resp.json();
    const output =
      data.output_text ||
      data.output?.[0]?.content?.find(c => c.type === "output_text")?.text;

    const plan = JSON.parse(output);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, plan }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err) }),
    };
  }
};
