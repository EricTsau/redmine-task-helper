import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Settings } from "@/pages/Settings";
import { Routes, Route } from "react-router-dom";
import { CommandPalette } from "@/components/command/CommandPalette";

function App() {
  return (
    <>
      <CommandPalette />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </>
  );
}

export default App;
