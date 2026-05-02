export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required.");
  const url = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  return new URL(url).toString();
}

export async function fetchText(url: string): Promise<{ url: string; html: string; status: number; headers: Headers }> {
  const normalized = normalizeUrl(url);
  const response = await fetch(normalized, {
    redirect: "follow",
    headers: {
      "user-agent": "SkyeGeoEngineStarter/0.1 (+https://workers.dev)",
      "accept": "text/html,application/xhtml+xml"
    }
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Expected HTML but received ${contentType || "unknown content type"}.`);
  }

  return {
    url: response.url,
    html: await response.text(),
    status: response.status,
    headers: response.headers
  };
}

export async function probeUrl(url: string): Promise<{ url: string; ok: boolean; status: number | null }> {
  try {
    const response = await fetch(url, { redirect: "follow", method: "GET" });
    return { url: response.url, ok: response.ok, status: response.status };
  } catch {
    return { url, ok: false, status: null };
  }
}
