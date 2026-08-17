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

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://emlmeml.github.io",
  ];

  const headers: HeadersInit = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
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

//Check if FactExtraction is correct
function isValidFactExtraction(
  data: unknown
): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const result = data as Record<string, unknown>;

  if (!Array.isArray(result.entities)) {
    return false;
  }

  if (!Array.isArray(result.facts)) {
    return false;
  }

  const validEntityTypes = [
    "person",
    "place",
    "organization",
    "object",
    "event",
  ];

  const entityIds = new Set<string>();

  // -----------------------------
  // Entities
  // -----------------------------

  for (const entity of result.entities) {
    if (!entity || typeof entity !== "object") {
      return false;
    }

    const e = entity as Record<string, unknown>;

    if (typeof e.id !== "string") {
      return false;
    }

    if (typeof e.name !== "string") {
      return false;
    }

    if (
      typeof e.type !== "string" ||
      !validEntityTypes.includes(e.type)
    ) {
      return false;
    }

    // Keine doppelten IDs
    if (entityIds.has(e.id)) {
      return false;
    }

    entityIds.add(e.id);
  }

  // -----------------------------
  // Facts
  // -----------------------------

  const validPredicates = [
    "age",
    "gender",
    "born_in",
    "lives_in",
    "works_at",
    "occupation",
    "sibling_of",
    "parent_of",
    "child_of",
    "married_to",
    "friend_of",
    "owns",
    "has",
    "located_in",
    "participates_in",
    "younger_than",
    "older_than",
  ];

  const relationalPredicates = [
    "sibling_of",
    "parent_of",
    "child_of",
    "married_to",
    "friend_of",
    "younger_than",
    "older_than",
  ];

  for (const fact of result.facts) {
    if (!fact || typeof fact !== "object") {
      return false;
    }

    const f = fact as Record<string, unknown>;

    // Subject
    if (typeof f.subject !== "string") {
      return false;
    }

    // Subject muss existieren
    if (!entityIds.has(f.subject)) {
      return false;
    }

    // Predicate
    if (
      typeof f.predicate !== "string" ||
      !validPredicates.includes(f.predicate)
    ) {
      return false;
    }

    // Value
    if (
      f.value !== undefined &&
      typeof f.value !== "string" &&
      typeof f.value !== "number" &&
      typeof f.value !== "boolean"
    ) {
      return false;
    }

    // Object
    if (
      f.object !== undefined &&
      typeof f.object !== "string"
    ) {
      return false;
    }

    // -----------------------------
    // Temporal Context
    // -----------------------------

    if (
      f.temporal !== undefined
    ) {
      if (
        !f.temporal ||
        typeof f.temporal !== "object"
      ) {
        return false;
      }

      const temporal =
        f.temporal as Record<string, unknown>;

      if (
        temporal.text !== undefined &&
        typeof temporal.text !== "string"
      ) {
        return false;
      }

      if (
        temporal.from !== undefined &&
        typeof temporal.from !== "string"
      ) {
        return false;
      }

      if (
        temporal.to !== undefined &&
        typeof temporal.to !== "string"
      ) {
        return false;
      }
    }

    // -----------------------------
    // Age
    // -----------------------------

    if (f.predicate === "age") {
      if (typeof f.value !== "number") {
        return false;
      }

      if (f.object !== undefined) {
        return false;
      }
    }

    // -----------------------------
    // Relationships
    // -----------------------------

    if (relationalPredicates.includes(f.predicate)) {
      if (typeof f.object !== "string") {
        return false;
      }

      if (!entityIds.has(f.object)) {
        return false;
      }

      if (f.value !== undefined) {
        return false;
      }
    }
  }

  return true;
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
            model: "openai/gpt-oss-20b:free",

            messages: [
                {
                    role: "user",
                    content: body.prompt,
                },
            ],

            temperature: 0,

            response_format: {
              type: "json_schema",
              json_schema: {
                name: "fact_extraction",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    entities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string"
                          },
                          name: {
                            type: "string"
                          },
                          type: {
                            type: "string",
                            enum: [
                              "person",
                              "place",
                              "organization",
                              "object",
                              "event"
                            ]
                          }
                        },
                        required: [
                          "id",
                          "name",
                          "type"
                        ],
                        additionalProperties: false
                      }
                    },

                    facts: {
                      type: "array",
                      items: {
                        type: "object",

                        properties: {
                          subject: {
                            type: "string",
                          },

                          predicate: {
                            type: "string",
                            enum: [
                              "age",
                              "gender",
                              "born_in",
                              "lives_in",
                              "works_at",
                              "occupation",
                              "sibling_of",
                              "parent_of",
                              "child_of",
                              "married_to",
                              "friend_of",
                              "owns",
                              "has",
                              "located_in",
                              "participates_in",
                              "younger_than",
                              "older_than",
                            ],
                          },

                          value: {
                            type: [
                              "string",
                              "number",
                              "boolean",
                            ],
                          },

                          object: {
                            type: "string",
                          },

                          temporal: {
                            type: "object",
                            properties: {
                              text: {
                                type: "string",
                              },
                            },
                            required: [],
                            additionalProperties: false,
                          },
                        },

                        required: [
                          "subject",
                          "predicate",
                        ],

                        additionalProperties: false,
                      },
                    },
                  },

                  required: [
                    "entities",
                    "facts"
                  ],

                  additionalProperties: false
                }
              }
            }
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

      const successData = data as OpenRouterResponse;

      const content =
        successData.choices?.[0]?.message?.content ?? "";

      if (!content) {
        return json(
          {
            error: "The AI returned an empty response."
          },
          502,
          origin
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(content);
      } catch {
          console.error(
          "INVALID AI JSON:",
          content
        );

        return json(
          {
            error: "The AI returned invalid JSON.",
            raw: content,
          },
          502,
          origin
        );
      }

      console.log(
        "FACT EXTRACTION RESULT:",
        JSON.stringify(parsed, null, 2)
      );

      if (!isValidFactExtraction(parsed)) {
        console.error(
          "INVALID FACT EXTRACTION:",
          JSON.stringify(parsed, null, 2)
        );

        return json(
          {
            error: "The AI returned JSON with an invalid structure.",
            raw: parsed,
          },
          502,
          origin
        );
      }

      return json(
        {
          response: parsed
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