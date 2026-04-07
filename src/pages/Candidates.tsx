import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Search, Download, Users, Loader2, Eye } from "lucide-react";

interface ScoreBreakdown {
  keyword_match: number;
  experience: number;
  skills: number;
  education: number;
  format: number;
  impact: number;
}

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  score: number;
  status: string;
  skills: string[];
  file_name: string | null;
  score_breakdown: ScoreBreakdown | null;
  experience: string | null;
  summary: string | null;
  created_at: string;
}

const statusColor: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  shortlisted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const breakdownLabels: { key: keyof ScoreBreakdown; label: string; max: number }[] = [
  { key: "keyword_match", label: "Keyword Match", max: 30 },
  { key: "experience", label: "Experience Quality", max: 25 },
  { key: "skills", label: "Skills Relevance", max: 20 },
  { key: "education", label: "Education", max: 10 },
  { key: "format", label: "Resume Format", max: 10 },
  { key: "impact", label: "Action & Impact", max: 5 },
];

const Candidates = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setCandidates(data as unknown as Candidate[]);
    setLoading(false);
  };

  useEffect(() => { fetchCandidates(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      toast({ title: "Updated", description: `Candidate ${status}` });
    }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-candidates");
      if (error) throw error;
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "candidates.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported!", description: "CSV file downloaded" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const filtered = candidates.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.file_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">Candidates</h1>
        <Button onClick={exportCSV} disabled={exporting} variant="outline" className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or file..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="shortlisted">Shortlisted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{candidates.length === 0 ? "No candidates yet. Upload resumes to get started." : "No matching candidates."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.file_name || "—"}</TableCell>
                    <TableCell>
                      <span className="font-bold text-accent">{c.score}</span>/100
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[c.status] || ""}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(c)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {c.status !== "shortlisted" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "shortlisted")}>Shortlist</Button>
                      )}
                      {c.status !== "rejected" && (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(c.id, "rejected")}>Reject</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">File</p>
                  <p className="text-foreground">{selected.file_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ATS Score</p>
                  <p className="font-bold text-xl text-accent">{selected.score}/100</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="text-foreground">{selected.email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusColor[selected.status] || ""}>{selected.status}</Badge>
                </div>
              </div>

              {selected.score_breakdown && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Score Breakdown</p>
                  <div className="space-y-2">
                    {breakdownLabels.map(({ key, label, max }) => {
                      const bd = selected.score_breakdown as ScoreBreakdown;
                      const val = bd[key] ?? 0;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium text-foreground">{val}/{max}</span>
                          </div>
                          <Progress value={(val / max) * 100} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected.skills && selected.skills.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.experience && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Experience</p>
                  <p className="text-sm text-foreground">{selected.experience}</p>
                </div>
              )}

              {selected.summary && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm text-foreground">{selected.summary}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Candidates;
