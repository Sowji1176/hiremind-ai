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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileName } = await req.json();
    if (!filePath || !fileName) {
      return new Response(JSON.stringify({ error: "filePath and fileName are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage.from("resumes").download(filePath);
    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text from file
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    let textContent = "";

    if (fileName.toLowerCase().endsWith(".pdf")) {
      const matches = rawText.match(/[\x20-\x7E\n\r\t]{20,}/g);
      textContent = matches ? matches.join(" ") : rawText.substring(0, 5000);
    } else {
      const matches = rawText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (matches) {
        textContent = matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
      } else {
        const readable = rawText.match(/[\x20-\x7E\n\r\t]{10,}/g);
        textContent = readable ? readable.join(" ") : rawText.substring(0, 5000);
      }
    }

    textContent = textContent.substring(0, 8000);

    // Derive fallback name from filename
    const fallbackName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]/g, " ")
      .replace(/resume/gi, "")
      .trim()
      .split(" ")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
      .trim() || "Candidate";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
            content: `You are an expert HR resume analyzer and ATS scoring engine. Extract structured information and provide a detailed, realistic ATS score breakdown.

SCORING RULES (STRICT):
- Total score: 0-100, calculated from 6 categories
- Keyword Match (0-30): How well skills/keywords match typical job descriptions
- Experience Quality (0-25): Internships count as REAL experience (15-20 pts). Full-time = higher. Only 0 if absolutely no experience/internships
- Skills Relevance (0-20): Relevance and breadth of technical/soft skills
- Education (0-10): Relevant degree/certification
- Resume Format (0-10): Clear sections, structure, formatting quality
- Action & Impact (0-5): Strong action verbs, measurable achievements

IMPORTANT:
- Internships are VALID experience. Never give 0 for experience if internships exist
- Fresher with internship: total score 50-70
- Experienced professional: 70-90
- Poor profile (no skills, no experience): 20-40
- DO NOT give random or fixed scores. Base everything on actual resume content
- Always try to extract the candidate's real name from the resume text. If not found, use "${fallbackName}" as the name.`,
          },
          {
            role: "user",
            content: `Analyze this resume and provide a detailed ATS score breakdown:\n\n${textContent}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_resume",
              description: "Extract structured candidate data with detailed ATS scoring",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name of the candidate extracted from the resume. If not found, use the fallback name." },
                  email: { type: "string", description: "Email address if found, empty string if not" },
                  skills: { type: "array", items: { type: "string" }, description: "List of technical and soft skills" },
                  experience: { type: "string", description: "Brief summary of work experience (2-3 sentences). Internships count as experience." },
                  total_score: { type: "integer", description: "Overall ATS score 0-100, sum of all category scores" },
                  keyword_match: { type: "integer", description: "Keyword match score 0-30" },
                  experience_score: { type: "integer", description: "Experience quality score 0-25" },
                  skills_score: { type: "integer", description: "Skills relevance score 0-20" },
                  education_score: { type: "integer", description: "Education score 0-10" },
                  format_score: { type: "integer", description: "Resume format & structure score 0-10" },
                  impact_score: { type: "integer", description: "Action words & impact score 0-5" },
                  summary: { type: "string", description: "2-3 sentence professional summary with scoring justification" },
                },
                required: ["name", "skills", "experience", "total_score", "keyword_match", "experience_score", "skills_score", "education_score", "format_score", "impact_score", "summary"],
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const candidateName = parsed.name && parsed.name !== "Unknown" ? parsed.name : fallbackName;
    const totalScore = Math.min(100, Math.max(0, parsed.total_score || 0));
    const scoreBreakdown = {
      keyword_match: Math.min(30, Math.max(0, parsed.keyword_match || 0)),
      experience: Math.min(25, Math.max(0, parsed.experience_score || 0)),
      skills: Math.min(20, Math.max(0, parsed.skills_score || 0)),
      education: Math.min(10, Math.max(0, parsed.education_score || 0)),
      format: Math.min(10, Math.max(0, parsed.format_score || 0)),
      impact: Math.min(5, Math.max(0, parsed.impact_score || 0)),
    };

    const resumeUrl = `${supabaseUrl}/storage/v1/object/public/resumes/${filePath}`;

    const { error: insertError } = await supabase.from("candidates").insert({
      user_id: user.id,
      name: candidateName,
      email: parsed.email || null,
      skills: parsed.skills || [],
      experience: parsed.experience || "",
      score: totalScore,
      score_breakdown: scoreBreakdown,
      file_name: fileName,
      summary: parsed.summary || "",
      status: "pending",
      resume_url: resumeUrl,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save candidate" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      name: candidateName,
      email: parsed.email || "",
      skills: parsed.skills || [],
      experience: parsed.experience || "",
      score: totalScore,
      score_breakdown: scoreBreakdown,
      file_name: fileName,
      summary: parsed.summary || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
