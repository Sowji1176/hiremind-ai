import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import GlobalHeader from "@/components/GlobalHeader";
import { Brain, FileText, Users, BarChart3, CheckCircle, ArrowRight } from "lucide-react";

const features = [
  { icon: Brain, title: "AI-Powered Analysis", desc: "AI-powered resume parsing extracts skills, experience, and generates match scores automatically." },
  { icon: FileText, title: "Smart Resume Parsing", desc: "Upload PDF or DOCX resumes and get structured data in seconds." },
  { icon: Users, title: "Candidate Management", desc: "Track, shortlist, and reject candidates with a clean dashboard interface." },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Visual charts and stats to track your hiring pipeline at a glance." },
];

const steps = [
  { num: "1", title: "Upload Resumes", desc: "Drag and drop PDF or DOCX files" },
  { num: "2", title: "AI Analyzes", desc: "Our AI extracts key info and scores candidates" },
  { num: "3", title: "Review & Decide", desc: "Shortlist or reject with one click" },
];


const Landing = () => (
  <div className="min-h-screen bg-background">
    <GlobalHeader />

    {/* Hero */}
    <section className="container mx-auto px-4 py-20 md:py-32 text-center">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
        Hire smarter, not harder
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
        AI-powered recruitment platform that analyzes resumes, scores candidates, and streamlines your hiring pipeline.
      </p>
      <div className="flex gap-4 justify-center">
        <Link to="/register">
          <Button size="lg" className="gap-2">Start Free <ArrowRight className="h-4 w-4" /></Button>
        </Link>
        <a href="#features">
          <Button size="lg" variant="outline">Learn More</Button>
        </a>
      </div>
    </section>

    {/* Features */}
    <section id="features" className="container mx-auto px-4 py-20">
      <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Powerful Features</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <f.icon className="h-10 w-10 text-accent mb-4" />
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* How it works */}
    <section className="bg-muted py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12 text-foreground">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">{s.num}</div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>


    {/* Footer */}
    <footer className="border-t py-8">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo className="h-6" />
          <span className="font-semibold text-foreground">HireMind AI</span>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 HireMind AI. All rights reserved.</p>
      </div>
    </footer>
  </div>
);

export default Landing;
