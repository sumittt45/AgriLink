import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "buyer_recommendations") {
      systemPrompt = "You are an AI assistant for AgriLink, a bulk agricultural marketplace. Provide crop recommendations for buyers based on seasonal availability, pricing trends, and demand. Keep responses concise as JSON with fields: recommendations (array of {crop, reason, estimated_price, season}).";
      userPrompt = `Given the buyer's location: ${context?.location || "India"} and current month, suggest 5 crops that are best to buy right now. Consider freshness, pricing, and bulk availability.`;
    } else if (type === "farmer_insights") {
      systemPrompt = "You are an AI agricultural advisor for AgriLink. Provide crop insights for farmers including price predictions, demand trends, and planting recommendations. Keep responses concise as JSON with fields: insights (array of {crop, trend, price_prediction, demand_level, recommendation}).";
      userPrompt = `Provide insights for a farmer in ${context?.location || "Maharashtra, India"} growing ${context?.crops || "vegetables"}. Include price trends, demand forecast, and what to plant next.`;
    } else if (type === "price_prediction") {
      systemPrompt = "You are a crop price prediction AI for AgriLink marketplace. Predict prices based on historical trends, season, and demand. Return JSON with fields: predictions (array of {crop, current_price, predicted_price_7d, predicted_price_30d, trend, confidence}).";
      userPrompt = `Predict prices for the following crops in ${context?.location || "India"}: ${context?.crops || "tomatoes, onions, potatoes, spinach, rice"}. Current month and typical Indian agricultural market trends.`;
    } else {
      throw new Error("Unknown insight type");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_insights",
              description: "Return agricultural insights as structured data",
              parameters: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        crop: { type: "string" },
                        detail: { type: "string" },
                        value: { type: "string" },
                        trend: { type: "string", enum: ["up", "down", "stable"] },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["crop", "detail", "value", "trend"],
                    },
                  },
                },
                required: ["data"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let insights;

    if (toolCall) {
      insights = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to parse content as JSON
      const content = result.choices?.[0]?.message?.content || "{}";
      try {
        insights = JSON.parse(content);
      } catch {
        insights = { data: [{ crop: "General", detail: content, value: "N/A", trend: "stable" }] };
      }
    }

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
