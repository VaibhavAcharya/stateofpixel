import {
  getSettings,
  getUser,
  handleAuthCallback,
  logout,
  MissingIdentityError,
  oauthLogin,
  onAuthChange,
  refreshSession,
} from "@netlify/identity";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthState = { isLoading: boolean; isAuthenticated: boolean };

const REDIRECT_KEY = "signInRedirectTo";
const AUTH_CALLBACK = /^#access_token=/;

export const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
});

export function isAuthCallback() {
  return AUTH_CALLBACK.test(window.location.hash);
}

function takeRedirectTo(): string {
  let redirectTo: string | null = null;
  try {
    redirectTo = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {}
  return redirectTo ?? `${window.location.pathname}${window.location.search}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    void (async () => {
      if (isAuthCallback()) {
        await handleAuthCallback().catch(() => null);
        window.location.replace(takeRedirectTo());
        return;
      }
      await refreshSession().catch(() => null);
      const user = await getUser();
      if (!active) {
        return;
      }
      setState({ isLoading: false, isAuthenticated: user !== null });
      unsubscribe = onAuthChange((_event, next) =>
        setState({ isLoading: false, isAuthenticated: next !== null }),
      );
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export const authActions = {
  signIn: async (
    provider: "github" | "google",
    { redirectTo }: { redirectTo: string },
  ) => {
    try {
      sessionStorage.setItem(REDIRECT_KEY, redirectTo);
    } catch {}
    try {
      oauthLogin(provider);
    } catch (error) {
      if (error instanceof MissingIdentityError) {
        throw error;
      }
    }
  },
  signOut: async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/";
    }
  },
};

export function useGoogleSignIn(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    getSettings()
      .then((settings) => setEnabled(settings.providers.google))
      .catch(() => {});
  }, []);
  return enabled;
}

export function useAuthActions() {
  return authActions;
}

export function Authenticated({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  return !isLoading && isAuthenticated ? children : null;
}

export function Unauthenticated({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  return !isLoading && !isAuthenticated ? children : null;
}

export function AuthLoading({ children }: { children: ReactNode }) {
  return useAuth().isLoading ? children : null;
}
