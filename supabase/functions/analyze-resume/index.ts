import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileName } = await req.json();
    if (!filePath || !fileName) {
      return new Response(JSON.stringify({ error: "filePath and fileName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text from file
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let textContent = "";

    // Simple text extraction - decode as UTF-8 for text-based content
    // For PDF/DOCX, extract readable text portions
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    
    if (fileName.toLowerCase().endsWith(".pdf")) {
      // Extract text between stream markers and readable portions
      const matches = rawText.match(/[\x20-\x7E\n\r\t]{20,}/g);
      textContent = matches ? matches.join(" ") : rawText.substring(0, 5000);
    } else {
      // DOCX - extract from XML content
      const matches = rawText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (matches) {
        textContent = matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
      } else {
        const readable = rawText.match(/[\x20-\x7E\n\r\t]{10,}/g);
        textContent = readable ? readable.join(" ") : rawText.substring(0, 5000);
      }
    }

    // Truncate to avoid token limits
    textContent = textContent.substring(0, 8000);

    // Call Lovable AI to analyze resume
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert HR resume analyzer. Extract structured information from resumes.",
          },
          {
            role: "user",
            content: `Analyze this resume text and extract the candidate's information:\n\n${textContent}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_resume",
              description: "Extract structured candidate data from a resume",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name of the candidate" },
                  email: { type: "string", description: "Email address if found, empty string if not" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of technical and soft skills",
                  },
                  experience: {
                    type: "string",
                    description: "Brief summary of work experience (2-3 sentences)",
                  },
                  score: {
                    type: "integer",
                    description: "Overall candidate quality score from 0-100 based on skills, experience, and presentation",
                  },
                  summary: {
                    type: "string",
                    description: "2-3 sentence professional summary of the candidate",
                  },
                },
                required: ["name", "skills", "experience", "score", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_resume" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const resumeUrl = `${supabaseUrl}/storage/v1/object/public/resumes/${filePath}`;

    // Save candidate to database
    const { error: insertError } = await supabase.from("candidates").insert({
      user_id: user.id,
      name: parsed.name || "Unknown",
      email: parsed.email || null,
      skills: parsed.skills || [],
      experience: parsed.experience || "",
      score: Math.min(100, Math.max(0, parsed.score || 0)),
      summary: parsed.summary || "",
      status: "pending",
      resume_url: resumeUrl,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save candidate" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
