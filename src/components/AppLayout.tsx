import { AppSidebar } from "@/components/AppSidebar";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-auto" style={{ marginLeft: 240 }}>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
