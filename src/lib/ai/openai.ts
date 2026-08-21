import OpenAI from "openai";

export function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/** Chama o modelo e devolve o texto (JSON) da resposta. */
export async function chamarModeloJson(prompt: string): Promise<string> {
  const client = getOpenAI();
  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  return r.choices[0]?.message?.content ?? "";
}
