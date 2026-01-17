import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Settings } from "@/pages/Settings";
import { FocusPage } from "@/pages/FocusPage";
import { Login } from "@/pages/Login";
import { Administration } from "@/pages/Administration";
import { AIPlannerPage } from "@/pages/AIPlannerPage";
import { Routes, Route, Navigate } from "react-router-dom";
import { CommandPalette } from "@/components/command/CommandPalette";
import { TimerProvider } from "@/contexts/TimerContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function AppContent() {
  const { token } = useAuth();

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <TimerProvider>
      <CommandPalette />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/ai-planner" element={<AIPlannerPage />} />
          <Route path="/admin" element={<ProtectedRoute><Administration /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </TimerProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
