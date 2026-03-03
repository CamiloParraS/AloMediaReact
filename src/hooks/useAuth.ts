import { useContext } from "react";
import { AuthContext, type AuthContextType } from "../context/AuthProvider";

/**
 * Convenience hook to consume the AuthContext.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
