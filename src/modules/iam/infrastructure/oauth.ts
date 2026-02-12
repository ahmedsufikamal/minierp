import { IamError } from "@/modules/iam/domain/errors";

export type OAuthProvider = "google" | "microsoft";

function getProviderConfig(provider: OAuthProvider) {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new IamError("INTERNAL_ERROR", "Google OAuth is not configured");

    return {
      clientId,
      clientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scopes: ["openid", "profile", "email"],
    };
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_OAUTH_TENANT_ID || "common";
  if (!clientId || !clientSecret) throw new IamError("INTERNAL_ERROR", "Microsoft OAuth is not configured");

  return {
    clientId,
    clientSecret,
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: ["openid", "profile", "email", "User.Read"],
  };
}

export function buildOAuthAuthorizeUrl(provider: OAuthProvider, state: string, redirectUri: string): string {
  const cfg = getProviderConfig(provider);
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scopes.join(" "));
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");
  }
  return url.toString();
}

export async function exchangeOAuthCode(input: {
  provider: OAuthProvider;
  code: string;
  redirectUri: string;
}): Promise<{ providerUserId: string; email: string; name: string; emailVerified: boolean }> {
  const cfg = getProviderConfig(input.provider);
  const tokenBody = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    throw new IamError("UNAUTHORIZED", "OAuth token exchange failed");
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new IamError("UNAUTHORIZED", "OAuth access token missing");
  }

  const profileRes = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileRes.ok) {
    throw new IamError("UNAUTHORIZED", "OAuth profile fetch failed");
  }

  const profile = (await profileRes.json()) as Record<string, unknown>;

  if (input.provider === "google") {
    const providerUserId = String(profile.sub ?? "");
    const email = String(profile.email ?? "");
    const name = String(profile.name ?? email);
    const emailVerified = profile.email_verified === true || profile.email_verified === "true";
    if (!providerUserId || !email || !emailVerified) {
      throw new IamError("UNAUTHORIZED", "Google account email must be verified");
    }
    return { providerUserId, email, name, emailVerified };
  }

  const providerUserId = String(profile.id ?? "");
  const email = String(profile.mail ?? profile.userPrincipalName ?? "");
  const name = String(profile.displayName ?? email);
  if (!providerUserId || !email) throw new IamError("UNAUTHORIZED", "Microsoft profile missing required fields");
  return { providerUserId, email, name, emailVerified: true };
}
