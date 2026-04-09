import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import GlobalHeader from "@/components/GlobalHeader";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <GlobalHeader />
      <SidebarProvider>
        <div className="flex flex-1 overflow-hidden w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center h-10 px-4 border-b md:hidden">
              <SidebarTrigger />
            </div>
            <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default AppLayout;
