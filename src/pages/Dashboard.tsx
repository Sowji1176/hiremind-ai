import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)"];

const Dashboard = () => {
  const [stats, setStats] = useState({ total: 0, shortlisted: 0, rejected: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.from("candidates").select("status");
      if (!error && data) {
        const total = data.length;
        const shortlisted = data.filter((c: any) => c.status === "shortlisted").length;
        const rejected = data.filter((c: any) => c.status === "rejected").length;
        const pending = data.filter((c: any) => c.status === "pending").length;
        setStats({ total, shortlisted, rejected, pending });
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: "Total Candidates", value: stats.total, icon: Users, color: "text-accent" },
    { title: "Shortlisted", value: stats.shortlisted, icon: UserCheck, color: "text-green-500" },
    { title: "Rejected", value: stats.rejected, icon: UserX, color: "text-destructive" },
    { title: "Pending", value: stats.pending, icon: FileText, color: "text-muted-foreground" },
  ];

  const barData = [
    { name: "Shortlisted", count: stats.shortlisted },
    { name: "Rejected", count: stats.rejected },
    { name: "Pending", count: stats.pending },
  ];

  const pieData = [
    { name: "Pending", value: stats.pending },
    { name: "Shortlisted", value: stats.shortlisted },
    { name: "Rejected", value: stats.rejected },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{loading ? "—" : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.total > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Candidates by Status</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && stats.total === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No candidates yet</h3>
            <p className="text-muted-foreground">Upload resumes to get started with AI analysis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
