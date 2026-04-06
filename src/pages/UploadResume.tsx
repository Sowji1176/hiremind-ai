import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, CheckCircle } from "lucide-react";

const ACCEPTED = ".pdf,.doc,.docx";

interface AnalysisResult {
  name: string;
  skills: string[];
  experience: string;
  score: number;
  summary: string;
}

const UploadResume = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validTypes.includes(f.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PDF or DOCX file.", variant: "destructive" });
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      // Upload file to storage
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("resumes").upload(path, file);
      if (uploadError) throw uploadError;

      // Call edge function
      const { data, error } = await supabase.functions.invoke("analyze-resume", {
        body: { filePath: path, fileName: file.name },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      toast({ title: "Analysis complete!", description: `${data.name} scored ${data.score}/100` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-foreground">Upload Resume</h1>

      <Card>
        <CardHeader><CardTitle>Upload a Resume</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {file ? file.name : "Click to upload or drag and drop"}
            </p>
            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX</p>
            <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFileChange} />
          </div>

          <Button onClick={handleAnalyze} disabled={!file || loading} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : "Analyze Resume"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" /> Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium text-foreground">{result.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="font-bold text-2xl text-accent">{result.score}/100</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Skills</p>
              <div className="flex flex-wrap gap-2">
                {result.skills.map((s) => (
                  <span key={s} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Experience</p>
              <p className="text-sm text-foreground">{result.experience}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Summary</p>
              <p className="text-sm text-foreground">{result.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UploadResume;
