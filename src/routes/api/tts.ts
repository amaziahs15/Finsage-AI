// TTS endpoint: generates speech audio via Gemini's native TTS API.
// Used by the chat widget to read AI answers aloud.
// Returns audio/wav (Gemini TTS emits raw 16-bit 24 kHz mono PCM;
// we wrap it in a minimal WAV header so any browser <audio> element plays it directly).
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Body = { text?: string; voice?: string };

// Build a minimal 44-byte WAV header for 16-bit PCM mono at 24 kHz.
function buildWavBuffer(pcmData: Uint8Array): Uint8Array {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.byteLength;
  const headerSize = 44;
  const buf = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buf);

  const enc = new TextEncoder();
  const writeStr = (offset: number, str: string) => {
    const bytes = enc.encode(str);
    bytes.forEach((b, i) => view.setUint8(offset + i, b));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  new Uint8Array(buf).set(pcmData, headerSize);
  return new Uint8Array(buf);
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Body;
        const text = (body.text || "").trim();
        if (!text) return new Response("Missing text", { status: 400 });

        // Auth check — consistent with /api/chat
        const authHeader = request.headers.get("authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData } = await supa.auth.getUser(token);
        if (!userData.user?.id) return new Response("Unauthorized", { status: 401 });

        const key = process.env.GEMINI_API_KEY;
        if (!key) return new Response("Missing GEMINI_API_KEY", { status: 500 });

        // Trim long input to keep synthesis snappy
        const safeText = text.slice(0, 3000);

        // Gemini native TTS — returns base64-encoded raw PCM audio
        const TTS_MODEL = "gemini-2.5-flash-preview-tts";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: safeText }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      // "Kore" is a clear, neutral English voice available on free tier
                      voiceName: "Kore",
                    },
                  },
                },
              },
            }),
          },
        );

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          return new Response(err || `TTS failed: ${res.status}`, { status: res.status });
        }

        const json = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
          }>;
        };

        const b64 = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!b64) {
          return new Response("TTS response missing audio data", { status: 502 });
        }

        // Decode base64 PCM and wrap in a WAV container
        const binary = atob(b64);
        const pcm = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) pcm[i] = binary.charCodeAt(i);
        const wav = buildWavBuffer(pcm);

        return new Response(wav, {
          headers: {
            "Content-Type": "audio/wav",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
