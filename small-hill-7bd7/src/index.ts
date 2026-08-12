interface Env {
  OPENROUTER_API_KEY: string;
}

interface ChatRequest {
  prompt: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenRouterErrorResponse {
  error?: {
    message?: string;
    code?: number;
  };
}

const ALLOWED_ORIGIN = "https://emlmeml.github.io";

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function json(
  data: unknown,
  status = 200,
  origin: string | null = null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const origin = request.headers.get("Origin");

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);

    // Only allow POST /api/chat
    if (
      request.method !== "POST" ||
      url.pathname !== "/api/chat"
    ) {
      return json(
        { error: "Not found" },
        404,
        origin
      );
    }

    // Parse request
    let body: ChatRequest;

    try {
      body = await request.json() as ChatRequest;
    } catch {
      return json(
        { error: "Invalid JSON" },
        400,
        origin
      );
    }

    if (
      !body.prompt ||
      typeof body.prompt !== "string"
    ) {
      return json(
        { error: "Missing prompt" },
        400,
        origin
      );
    }

    // Prevent huge requests
    if (body.prompt.length > 50_000) {
      return json(
        { error: "Prompt is too large" },
        413,
        origin
      );
    }

    // Check API key
    if (!env.OPENROUTER_API_KEY) {
      return json(
        {
          error:
            "OpenRouter API key is not configured",
        },
        500,
        origin
      );
    }

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Authorization":
              `Bearer ${env.OPENROUTER_API_KEY}`,

            "Content-Type":
              "application/json",

            "HTTP-Referer":
              "https://emlmeml.github.io/RippleAnimation/",

            "X-Title":
              "Ripple Animation",
          },

          body: JSON.stringify({
            model: "openrouter/free",

            messages: [
              {
                role: "user",
                content: body.prompt,
              },
            ],

            temperature: 0.1,
          }),
        }
      );

      // Tell TypeScript what we expect from OpenRouter
      const data = await response.json() as
        | OpenRouterResponse
        | OpenRouterErrorResponse;

      if (!response.ok) {
        console.error(
          "OpenRouter error:",
          data
        );

        return json(
          {
            error: "OpenRouter request failed",
            details: data,
          },
          response.status,
          origin
        );
      }

      // Safely extract the answer
      const successData =
        data as OpenRouterResponse;

      const content =
        successData.choices?.[0]?.message?.content ??
        "";

      return json(
        {
          response: content,
        },
        200,
        origin
      );

    } catch (error) {
      console.error(error);

      return json(
        {
          error: "Internal server error",
        },
        500,
        origin
      );
    }
  },
};