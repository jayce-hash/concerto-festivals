import OpenAI from "openai";

export const handler = async (event) => {
  try {
    const { festival, day, prompt, lineup, savedSets } = JSON.parse(event.body || "{}");

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const input = `
You are Concerto's Festival Planner.
Festival: ${festival?.name || ""} (${festival?.city || ""}, ${festival?.state || ""})
Day: ${day || "N/A"}

User preferences:
${prompt || "(none)"}

Lineup JSON (if provided):
${lineup ? JSON.stringify(lineup).slice(0, 12000) : "(none)"}

Saved sets (if provided):
${savedSets ? JSON.stringify(savedSets).slice(0, 4000) : "(none)"}

Return ONLY valid JSON with:
{
  "dayPlanTitle": "",
  "schedule": [{"time":"","title":"","details":""}],
  "tips": ["",""],
  "arrival": {"bestTime":"","notes":["",""]},
  "foodBreaks": [{"time":"","idea":""}],
  "exit": {"whenToLeave":"","notes":["",""]}
}
`.trim();

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, text: resp.output_text })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
