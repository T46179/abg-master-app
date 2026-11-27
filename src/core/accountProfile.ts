import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function signInMethods(password: boolean | null, google: boolean | null) {
  return {
    password: password === null ? "Unknown" : password ? "Password enabled" : "No password configured",
    google: google === null ? "Unknown" : google ? "Connected" : "Not connected"
  };
}

export function preferredNameStore(origin: string, userId: string, publicKey: string, owned: SupabaseClient, useMetadata: boolean) {
  const key = "abgm-preferred-name:" + new URL(origin).origin + ":" + userId;
  return {
    local: !useMetadata,
    read(metadata: Record<string, unknown>) {
      if (!useMetadata) return localStorage.getItem(key) ?? "";
      return typeof metadata.preferred_name === "string" ? metadata.preferred_name : "";
    },
    async save(input: string) {
      const name = input.trim();
      if (Array.from(name).length > 40) throw new Error("Use 40 characters or fewer.");
      if (!useMetadata) {
        if (name) localStorage.setItem(key, name);
        else localStorage.removeItem(key);
        return name;
      }
      // Bind the write to the verified owner's session, even if the site changes accounts.
      const { data } = await owned.auth.getSession();
      if (!data.session || data.session.user.id !== userId) throw new Error("Account changed.");
      const writer = createClient(origin, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "abgm-profile-" + crypto.randomUUID() } });
      const { access_token, refresh_token } = data.session;
      const installed = await writer.auth.setSession({ access_token, refresh_token });
      if (installed.error || installed.data.user?.id !== userId) throw new Error("Account changed.");
      const result = await writer.auth.updateUser({ data: { preferred_name: name || null } });
      if (result.error || result.data.user?.id !== userId) throw new Error("Name could not be saved.");
      return name;
    }
  };
}
