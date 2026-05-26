import { prisma } from "@navaxa/db";

// Cost: ~$0.007/call (Haiku 4.5, ~2.5k in + 0.8k out) → ~$7 USD a 1.000 calls/mes.
// El system prompt (~100 tokens) está muy por debajo del mínimo cacheable de Haiku
// (4096 tokens), así que prompt caching aquí no tendría efecto — no se aplica.
const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";

export interface RecommendationOutput {
  suggestedStyle: string;
  reasoning: string;
  fadeType: "low" | "mid" | "high" | "skin" | "taper" | "none";
  topLength: "short" | "medium" | "long";
  alternatives: { name: string; reason: string }[];
  warnings: string[];
}

export async function recommendNextHaircut(
  clientId: string,
): Promise<RecommendationOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada. Define la variable de entorno para usar la IA.",
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      preferences: true,
      haircuts: {
        orderBy: { performedAt: "desc" },
        take: 8,
        select: {
          style: true,
          notes: true,
          rating: true,
          performedAt: true,
        },
      },
    },
  });

  if (!client) throw new Error("Cliente no encontrado");

  const now = new Date();
  const month = now.getMonth(); // 0-11
  const isSummerChile = month >= 11 || month <= 2; // dic, ene, feb

  const inputSummary = {
    client: {
      firstName: client.firstName,
      visits: client.totalVisits,
      tags: client.tags,
    },
    preferences: client.preferences && {
      hairType: client.preferences.hairType,
      preferredStyle: client.preferences.preferredStyle,
      fadeType: client.preferences.fadeType,
      topLength: client.preferences.topLength,
      beardStyle: client.preferences.beardStyle,
      allergies: client.preferences.allergies,
      notes: client.preferences.notes,
    },
    recentHaircuts: client.haircuts.map((h) => ({
      style: h.style,
      notes: h.notes,
      rating: h.rating,
      daysAgo: Math.floor(
        (Date.now() - h.performedAt.getTime()) / 86_400_000,
      ),
    })),
    context: {
      date: now.toISOString().slice(0, 10),
      season: isSummerChile ? "verano (Chile)" : "otoño/invierno (Chile)",
    },
  };

  const systemPrompt = `Eres un barbero senior con 20 años de experiencia trabajando en Chile. Analiza el historial de un cliente y recomienda el próximo corte óptimo. Considera continuidad estilística, ratings (cortes con rating 4-5 deben influir más, los de 1-3 indican qué evitar), estacionalidad (cortes más cortos en verano), y preferencias explícitas. Responde SIEMPRE en JSON válido sin markdown ni texto adicional.`;

  const userPrompt = `Datos del cliente:

${JSON.stringify(inputSummary, null, 2)}

Responde EXACTAMENTE con este JSON:
{
  "suggestedStyle": "nombre corto y descriptivo (ej: 'Fade medio con top texturizado')",
  "reasoning": "1-2 oraciones explicando por qué basado en el historial",
  "fadeType": "low" | "mid" | "high" | "skin" | "taper" | "none",
  "topLength": "short" | "medium" | "long",
  "alternatives": [
    { "name": "alternativa 1", "reason": "por qué" },
    { "name": "alternativa 2", "reason": "por qué" }
  ],
  "warnings": ["si detectas monotonía, ratings bajos o riesgos, agrega aquí; si todo bien, array vacío"]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? "";
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();

  let parsed: RecommendationOutput;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Respuesta de IA no parseable: ${clean.slice(0, 200)}`);
  }

  // Validación mínima
  if (!parsed.suggestedStyle || !parsed.reasoning) {
    throw new Error("Respuesta de IA incompleta");
  }

  await prisma.aIRecommendation.create({
    data: {
      tenantId: client.tenantId,
      clientId: client.id,
      modelVersion: MODEL,
      inputSummary: inputSummary as object,
      recommendation: parsed as object,
    },
  });

  return parsed;
}
