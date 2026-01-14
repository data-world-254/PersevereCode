const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");

export async function completeDeviceLogin(userCode: string, supabaseAccessToken: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/auth/device/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
    body: JSON.stringify({ user_code: userCode }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as any));
    const err = typeof body?.error === "string" ? body.error : `Request failed: ${res.status}`;
    const details = body?.details ? `\n${JSON.stringify(body.details)}` : "";
    throw new Error(`${err}${details}`);
  }
}
