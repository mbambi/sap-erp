import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import TCodePalette from "./TCodePalette";
import CollaborationPanel from "./CollaborationPanel";
import ModuleInfoBanner from "./ModuleInfoBanner";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <TCodePalette />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          <ModuleInfoBanner />
          <Outlet />
        </main>
      </div>
      <CollaborationPanel />
    </div>
  );
}
