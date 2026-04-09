import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText } from "https://esm.sh/unpdf";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function extractPdfContent(fileData: Blob): Promise<string> {
  const buffer = await fileData.arrayBuffer();
  if (buffer.byteLength > 15 * 1024 * 1024) {
    throw new Error(`PDF too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
  }
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text.slice(0, 40000);
}

function extractDocxText(fileData: Blob): Promise<string> {
  return fileData.arrayBuffer().then(buf => {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buf));
    const matches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (matches) return matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ").slice(0, 40000);
    const readable = raw.match(/[\x20-\x7E\n\r\t]{10,}/g);
    return readable ? readable.join(" ").slice(0, 40000) : raw.substring(0, 5000);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { filePath, fileName } = await req.json();
    if (!filePath || !fileName) return jsonResponse({ error: "filePath and fileName are required" }, 400);

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage.from("resumes").download(filePath);
    if (downloadError || !fileData) return jsonResponse({ error: "Failed to download file" }, 400);

    // Detect file type and extract text
    const lowerName = fileName.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png)$/.test(lowerName);
    const isDocx = /\.(doc|docx)$/.test(lowerName);

    let textContent: string | null = null;
    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;

    if (isImage) {
      // For images, encode as base64 and use Gemini vision for OCR
      const buffer = await fileData.arrayBuffer();
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      imageMimeType = lowerName.endsWith(".png") ? "image/png" : "image/jpeg";
    } else {
      try {
        textContent = isPdf ? await extractPdfContent(fileData) : await extractDocxText(fileData);
      } catch (extractErr) {
        console.error("Text extraction error:", extractErr);
        return jsonResponse({ error: "Failed to extract text from file" }, 400);
      }

      if (!textContent || textContent.trim().length < 20) {
        return jsonResponse({ error: "Could not extract readable text from the uploaded file" }, 400);
      }
    }

    // Fallback name from filename
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
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI service not configured" }, 500);

    const systemPrompt = `You are an expert HR resume analyzer and ATS scoring engine. Extract structured information and provide a detailed, realistic ATS score breakdown.

SCORING RULES (STRICT):
- Total score: 0-100, calculated from 6 categories
- Keyword Match (0-30): How well skills/keywords match typical job descriptions
- Experience Quality (0-25): Internships count as REAL experience (15-20 pts). Full-time = higher. Only 0 if absolutely no experience/internships
- Skills Relevance (0-20): Relevance and breadth of technical/soft skills
- Education (0-10): Relevant degree/certification
- Resume Format (0-10): Clear sections, structure, formatting quality
- Action & Impact (0-5): Strong action verbs, measurable achievements

SCORING GUIDELINES:
- Internships are VALID experience. Never give 0 for experience if internships exist
- Fresher with internship: total score 50-70
- Experienced professional: 70-90
- Poor profile (no skills, no experience): 20-40
- DO NOT give random or fixed scores. Base everything on actual resume content
- Always try to extract the candidate's real name from the resume text. If not found, use "${fallbackName}" as the name.

=== CRITICAL ANTI-HALLUCINATION RULES ===

ABSOLUTE RULE: You are FORBIDDEN from generating, inventing, or inferring ANY data not explicitly written in the resume text.

SKILLS:
- Extract ONLY skills that are explicitly written in the resume (e.g. listed in a "Skills" section or clearly mentioned).
- DO NOT infer skills from job titles or context.
- If no skills section or explicit skills found → return ["NA"]

EXPERIENCE:
- Extract ALL types: full-time jobs, internships, job simulations, virtual experience programs, part-time, freelance.
- Preserve the EXACT role title and company name as written in the resume.
- DO NOT rename roles. DO NOT change company names.
- DO NOT invent companies unless they are explicitly written.
- If no experience found → return "NA"

EDUCATION (CRITICAL):
- Extract ONLY the degree/qualification explicitly written in the resume.
- DO NOT assume or generate any degree (B.Tech, B.Sc, MBA, etc.) unless it is explicitly stated.
- If no education section or degree is found → return "NA".
- Preserve exact wording.

MULTIPLE EXPERIENCES (CRITICAL):
- Extract EVERY experience entry found in the resume — not just the first one.
- List each as a separate entry separated by " | ".
- If 4 experiences exist, list all 4. Never truncate or merge.

SUMMARY:
- Must be 100% factual, based ONLY on resume content.
- DO NOT assume job functions, capabilities, or interests not stated.

VERIFICATION STEP (MANDATORY):
Before returning your output, verify each item:
- Is every skill explicitly written in the resume? If not → REMOVE IT.
- Is every company name explicitly in the resume? If not → REMOVE IT.
- Is every role title exactly as written? If not → CORRECT IT.
- Is the summary based only on resume facts? If not → REWRITE IT.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          imageBase64
            ? {
                role: "user",
                content: [
                  { type: "text", text: "This is an image of a resume. Extract ALL text using OCR, then analyze it and provide a detailed ATS score breakdown." },
                  { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
                ],
              }
            : { role: "user", content: `Analyze this resume and provide a detailed ATS score breakdown:\n\n${textContent}` },
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
                  skills: { type: "array", items: { type: "string" }, description: "ONLY explicitly listed skills. If none found, return ['NA']." },
                  experience: { type: "string", description: "ALL experience entries separated by ' | '. Use exact role titles and company names. If none found, return 'NA'." },
                  education: { type: "string", description: "Exact degree/qualification as written in resume. If not found, return 'NA'. DO NOT assume any degree." },
                  total_score: { type: "integer", description: "Overall ATS score 0-100, sum of all category scores" },
                  keyword_match: { type: "integer", description: "Keyword match score 0-30" },
                  experience_score: { type: "integer", description: "Experience quality score 0-25" },
                  skills_score: { type: "integer", description: "Skills relevance score 0-20" },
                  education_score: { type: "integer", description: "Education score 0-10" },
                  format_score: { type: "integer", description: "Resume format & structure score 0-10" },
                  impact_score: { type: "integer", description: "Action words & impact score 0-5" },
                  summary: { type: "string", description: "2-3 sentence factual summary based ONLY on resume content. No assumptions." },
                },
                required: ["name", "skills", "experience", "education", "total_score", "keyword_match", "experience_score", "skills_score", "education_score", "format_score", "impact_score", "summary"],
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
      if (aiResponse.status === 429) return jsonResponse({ error: "AI rate limit exceeded. Please try again later." }, 429);
      if (aiResponse.status === 402) return jsonResponse({ error: "AI credits exhausted. Please add funds." }, 402);
      return jsonResponse({ error: "AI analysis failed" }, 500);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return jsonResponse({ error: "AI did not return structured data" }, 500);

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
      return jsonResponse({ error: "Failed to save candidate" }, 500);
    }

    return jsonResponse({
      name: candidateName,
      email: parsed.email || "",
      skills: parsed.skills || [],
      experience: parsed.experience || "",
      education: parsed.education || "NA",
      score: totalScore,
      score_breakdown: scoreBreakdown,
      file_name: fileName,
      summary: parsed.summary || "",
    });
  } catch (e) {
    console.error("Error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
