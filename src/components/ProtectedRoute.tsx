import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { StarField } from "@/components/magic/StarField";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="relative min-h-screen bg-night flex items-center justify-center overflow-hidden">
        <StarField />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
          <p className="text-foreground/70 font-display">Waking the storyteller…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};
