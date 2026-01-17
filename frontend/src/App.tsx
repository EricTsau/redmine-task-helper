import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Settings } from "@/pages/Settings";
import { FocusPage } from "@/pages/FocusPage";
import { Routes, Route } from "react-router-dom";
import { CommandPalette } from "@/components/command/CommandPalette";
import { TimerProvider } from "@/contexts/TimerContext";

function App() {
  return (
    <TimerProvider>
      <CommandPalette />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/focus" element={<FocusPage />} />
        </Routes>
      </Layout>
    </TimerProvider>
  );
}

export default App;
