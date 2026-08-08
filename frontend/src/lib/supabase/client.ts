import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  if (process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH === "true") {
    const accessToken = process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_TOKEN;
    if (!accessToken) {
      throw new Error("NEXT_PUBLIC_LOCAL_DEV_AUTH_TOKEN is required in local development");
    }

    const localSession = { access_token: accessToken };
    const localUser = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "developer@localhost",
    };
    return {
      auth: {
        getSession: async () => ({ data: { session: localSession }, error: null }),
        getUser: async () => ({ data: { user: localUser }, error: null }),
        signInWithOAuth: async () => ({ data: { provider: "google", url: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
    };
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
