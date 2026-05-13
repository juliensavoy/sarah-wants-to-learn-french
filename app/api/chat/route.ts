import { getAnthropic, getClaudeModel } from "@/lib/anthropic";
import { getLearnerProgressForPrompt } from "@/lib/learner-context";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as {
      messages?: ChatMessage[];
    };
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const learnerBlock = await getLearnerProgressForPrompt();
    const system = [
      "You are a French tutor. Correct mistakes gently.",
      "",
      learnerBlock,
    ].join("\n");

    const client = getAnthropic();
    const stream = await client.messages.stream({
      model: getClaudeModel(),
      max_tokens: 2048,
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const ev of stream) {
            if (ev.type === "content_block_delta") {
              const d = ev.delta;
              if (d.type === "text_delta" && "text" in d) {
                controller.enqueue(encoder.encode(d.text));
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
