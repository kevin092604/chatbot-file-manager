import { createContext, useContext, useState, useEffect } from "react";
import {
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  confirmSignIn,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";

const AuthContext = createContext(null);

const IS_MOCK = import.meta.env.VITE_AUTH_MOCK === "true";

const MOCK_USERS = {
  "admin@unah.edu.hn": {
    email: "admin@unah.edu.hn",
    groups: ["admin"],
    name: "Admin UNAH",
  },
  "juan@unah.edu.hn": {
    email: "juan@unah.edu.hn",
    groups: ["voae"],
    name: "Juan Perez",
  },
  "maria@unah.edu.hn": {
    email: "maria@unah.edu.hn",
    groups: ["vra"],
    name: "Maria Lopez",
  },
};

function parseUserFromSession(session) {
  const idToken = session.tokens?.idToken;
  if (!idToken) return null;

  const payload = idToken.payload;
  return {
    email: payload.email,
    name: payload.name || payload.email,
    groups: payload["cognito:groups"] || [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      if (IS_MOCK) {
        const saved = localStorage.getItem("voae_user");
        if (saved) setUser(JSON.parse(saved));
        return;
      }

      await getCurrentUser();
      const session = await fetchAuthSession();
      const userData = parseUserFromSession(session);
      if (userData) setUser(userData);
    } catch {
      // No hay sesion activa
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (IS_MOCK) {
      const mockUser = MOCK_USERS[email];
      if (!mockUser) throw new Error("Usuario no encontrado");
      localStorage.setItem("voae_user", JSON.stringify(mockUser));
      setUser(mockUser);
      return mockUser;
    }

    const result = await cognitoSignIn({ username: email, password });

    if (result.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      setNewPasswordRequired(true);
      return { newPasswordRequired: true };
    }

    if (!result.isSignedIn) throw new Error("No se pudo iniciar sesion");

    const session = await fetchAuthSession();
    const userData = parseUserFromSession(session);
    if (!userData) throw new Error("No se pudo obtener la sesion");
    setUser(userData);
    return userData;
  };

  const completeNewPassword = async (newPassword) => {
    const result = await confirmSignIn({ challengeResponse: newPassword });
    if (!result.isSignedIn) throw new Error("No se pudo completar el cambio de contrasena");

    setNewPasswordRequired(false);
    const session = await fetchAuthSession();
    const userData = parseUserFromSession(session);
    if (!userData) throw new Error("No se pudo obtener la sesion");
    setUser(userData);
    return userData;
  };

  const signOut = async () => {
    if (IS_MOCK) {
      localStorage.removeItem("voae_user");
    } else {
      await cognitoSignOut();
    }
    setUser(null);
  };

  const isAdmin = user?.groups?.includes("admin") || false;
  const vicerrectoria = isAdmin ? "admin" : user?.groups?.[0] || null;

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signOut, completeNewPassword, newPasswordRequired, isAdmin, vicerrectoria }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
