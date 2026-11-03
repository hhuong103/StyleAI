export default async function waitForApplication() {
  const origin = process.env.E2E_BASE_URL || "http://localhost:3000";
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const web = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      const api = await fetch(`${origin}/api/v1/auth/csrf`, {
        signal: AbortSignal.timeout(1000),
      });
      if (web.ok && api.ok) return;
    } catch {
      /* The separately started web/API may still be starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Web/API not ready at ${origin}. Start the seeded API and production web server before E2E.`,
  );
}
