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
    const { festival, userPrefs } = body || {};

    const system = `You are Concerto's Festival Planner AI.
Return concise, scannable output in plain text with short headings + bullets.
No markdown tables. No emojis.`;

    const user = `
Festival:
${JSON.stringify(festival, null, 2)}

User preferences:
${JSON.stringify(userPrefs, null, 2)}

Task:
Create a 1-day festival plan:
- Best arrival window + first steps
- A lineup strategy (must-see first; avoid conflicts; suggest swaps)
- Food + hydration timing
- Exit plan + rideshare tip
Keep it tight and practical.
`.trim();

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.6,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: user }],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(errText, { status: resp.status });
    }

    const data = await resp.json();

    // Responses API: easiest accessor
    const text =
      data?.output_text ||
      data?.output?.[0]?.content?.map((c) => c?.text).filter(Boolean).join("\n") ||
      "No response.";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
};
