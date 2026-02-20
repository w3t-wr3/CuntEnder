import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface VerifyResult {
  success: boolean;
  winner_name: string | null;
  loser_name: string | null;
  winner_score: number | null;
  loser_score: number | null;
  confidence: number;
  raw_json: Record<string, unknown>;
  model_used: "haiku" | "sonnet";
  error?: string;
}

function buildVisionPrompt(makerName?: string, takerName?: string): string {
  const knownPlayers =
    makerName && takerName
      ? `\n\nThe two players in this challenge are: "${makerName}" and "${takerName}". Match the winner to one of these names. The names on screen may have clan tags, platform suffixes, or slight formatting differences — match by the closest username.`
      : "";

  return `You are analyzing a Rocket League scoreboard or match result screenshot to determine the winner of a 1v1 match.

Extract the following from the screenshot:
- player1_name: first player's name as shown on screen
- player1_score: first player's score (goals)
- player2_name: second player's name as shown on screen
- player2_score: second player's score (goals)
- winner_name: the player with more goals (use the EXACT name from the known players list if provided and it matches)
- match_type: should be "1v1" or similar
- confidence: your confidence 0.0-1.0 that this is a legitimate Rocket League result screenshot

Rules:
- Accept any Rocket League result screen: post-game scoreboard, match history, or results screen
- The winner is the player with the higher score
- If you cannot determine the winner clearly, set confidence below 0.5${knownPlayers}

Respond with ONLY valid JSON, no markdown fences, no explanation:
{"player1_name":"...","player1_score":0,"player2_name":"...","player2_score":0,"winner_name":"...","match_type":"...","confidence":0.0}`;
}

function parseResponse(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

async function analyzeWithModel(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp",
  model: string,
  makerName?: string,
  takerName?: string
): Promise<{ parsed: Record<string, unknown>; raw: string }> {
  const prompt = buildVisionPrompt(makerName, takerName);
  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = parseResponse(raw);
  return { parsed, raw };
}

export async function verifyProof(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  makerName?: string,
  takerName?: string
): Promise<VerifyResult> {
  // Try Haiku first
  try {
    const { parsed } = await analyzeWithModel(
      imageBase64,
      mediaType,
      "claude-haiku-4-5-20251001",
      makerName,
      takerName
    );

    const confidence = Number(parsed.confidence ?? 0);

    if (confidence >= 0.85) {
      const winnerScore =
        parsed.winner_name === parsed.player1_name
          ? Number(parsed.player1_score)
          : Number(parsed.player2_score);
      const loserScore =
        parsed.winner_name === parsed.player1_name
          ? Number(parsed.player2_score)
          : Number(parsed.player1_score);
      const loserName =
        parsed.winner_name === parsed.player1_name
          ? String(parsed.player2_name)
          : String(parsed.player1_name);

      return {
        success: true,
        winner_name: String(parsed.winner_name),
        loser_name: loserName,
        winner_score: winnerScore,
        loser_score: loserScore,
        confidence,
        raw_json: parsed,
        model_used: "haiku",
      };
    }

    // Fall through to Sonnet
  } catch (e) {
    console.error("Haiku analysis failed, falling back to Sonnet:", e);
  }

  // Sonnet fallback
  try {
    const { parsed } = await analyzeWithModel(
      imageBase64,
      mediaType,
      "claude-sonnet-4-6",
      makerName,
      takerName
    );

    const confidence = Number(parsed.confidence ?? 0);
    const winnerScore =
      parsed.winner_name === parsed.player1_name
        ? Number(parsed.player1_score)
        : Number(parsed.player2_score);
    const loserScore =
      parsed.winner_name === parsed.player1_name
        ? Number(parsed.player2_score)
        : Number(parsed.player1_score);
    const loserName =
      parsed.winner_name === parsed.player1_name
        ? String(parsed.player2_name)
        : String(parsed.player1_name);

    return {
      success: confidence >= 0.5,
      winner_name: String(parsed.winner_name),
      loser_name: loserName,
      winner_score: winnerScore,
      loser_score: loserScore,
      confidence,
      raw_json: parsed,
      model_used: "sonnet",
    };
  } catch (e) {
    return {
      success: false,
      winner_name: null,
      loser_name: null,
      winner_score: null,
      loser_score: null,
      confidence: 0,
      raw_json: {},
      model_used: "sonnet",
      error: String(e),
    };
  }
}
