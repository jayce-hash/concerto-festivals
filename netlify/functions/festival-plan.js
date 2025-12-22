export default async (req, context) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    const body = await req.json();
    const { festival, prefs } = body || {};
    if (!festival?.name) {
      return new Response("Missing festival data", { status: 400 });
    }

    // Keep prompt tight + structured
    const instructions = `
You are Concerto's festival concierge. Create a clear, practical festival plan.
Return ONLY valid JSON matching the schema. No markdown.
Tone: concise, premium, helpful.
`;

    const schema = {
      name: "festival_plan",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          arrival: { type: "array", items: { type: "string" } },
          essentials: { type: "array", items: { type: "string" } },
          daily_plan: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                day_label: { type: "string" },
                timeline: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      time: { type: "string" },
                      title: { type: "string" },
                      detail: { type: "string" }
                    },
                    required: ["time", "title", "detail"]
                  }
                }
              },
              required: ["day_label", "timeline"]
            }
          },
          food_and_afters: { type: "array", items: { type: "string" } },
          pro_tips: { type: "array", items: { type: "string" } }
        },
        required: ["summary", "arrival", "essentials", "daily_plan", "food_and_afters", "pro_tips"]
      }
    };

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        instructions,
        input: [
          {
            role: "user",
     content: [
  {
    type: "input_text",
    text: JSON.stringify({
      festival: {
        id: festival.id,
        name: festival.name,
        city: festival.city,
        state: festival.state,
        country: festival.country,
        venue: festival.venue,
        startDate: festival.startDate,
        endDate: festival.endDate,
        genres: festival.genres,
        hasCamping: festival.hasCamping
      },
      prefs: prefs || {}
    })
  }
]
          }
        ],
        text: {
          format: { type: "json_schema", json_schema: schema }
        }
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(errText, { status: openaiRes.status });
    }

    const data = await openaiRes.json();

    // Responses API: the model output is in output_text / content blocks.
    // We'll be defensive and extract the first JSON-looking text.
    const outputText =
      data.output_text ||
      data?.output?.[0]?.content?.find?.(c => c.type === "output_text")?.text ||
      "";

    return new Response(outputText, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(String(e?.message || e), { status: 500 });
  }
};
