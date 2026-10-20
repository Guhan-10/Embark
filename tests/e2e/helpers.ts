import { readFileSync } from "node:fs";
import path from "node:path";
import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { BASE_URL, E2E_DOMAIN, MAILPIT_URL, PASSWORD } from "./env";

/** People created by tests/e2e/fixtures-seed.ts. Each signs in from its own address (sign-in is rate-limited per IP). */
export const PERSONAS = {
  ada: { name: "Ada Admin", ip: "10.10.0.1" },
  hari: { name: "Hari Prasad", ip: "10.10.0.2" },
  meera: { name: "Meera Iyer", ip: "10.10.0.3" },
  rahul: { name: "Rahul Verma", ip: "10.10.0.4" },
  anil: { name: "Anil Kumar", ip: "10.10.0.5" },
  bina: { name: "Bina Das", ip: "10.10.0.6" },
  chen: { name: "Chen Li", ip: "10.10.0.7" },
} as const;
export type Persona = keyof typeof PERSONAS;

export const emailOf = (who: string) => `${who}@${E2E_DOMAIN}`;

type Fixtures = {
  employees: Record<"anil" | "bina" | "chen" | "rahul" | "hari" | "meera", string>;
  processes: Record<"anil" | "bina" | "chen", string>;
  tasks: Record<"anilHandbook" | "binaHandbook" | "chenHandbook", string>;
  documents: Record<"chen", string>;
};

let fixtures: Fixtures | null = null;
/** Ids of the fixture records (written by global setup, so read on first use). */
export function ids(): Fixtures {
  fixtures ??= JSON.parse(readFileSync(path.join(import.meta.dirname, ".state", "fixtures.json"), "utf8")) as Fixtures;
  return fixtures;
}

const sessions = new Map<Persona, Awaited<ReturnType<BrowserContext["storageState"]>>>();

/** A browser context signed in as the persona. The session is reused across tests in the same worker. */
async function contextFor(browser: Browser, who: Persona, options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext({
    ...options,
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": PERSONAS[who].ip },
    storageState: sessions.get(who),
  });
  if (!sessions.has(who)) {
    const response = await context.request.post("/api/auth/sign-in/email", {
      data: { email: emailOf(who), password: PASSWORD },
      headers: { Origin: BASE_URL },
    });
    expect(response.ok(), `sign in as ${who}: ${response.status()} ${await response.text()}`).toBeTruthy();
    sessions.set(who, await context.storageState());
  }
  return context;
}

/** `as("hari")` opens a page signed in as Hari, in its own browser context (closed after the test). */
export const test = base.extend<{ as: (who: Persona) => Promise<Page> }>({
  as: async ({ browser, contextOptions, viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, timezoneId }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (who) => {
      const context = await contextFor(browser, who, { ...contextOptions, viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, timezoneId });
      contexts.push(context);
      return context.newPage();
    });
    for (const context of contexts) await context.close();
  },
});

export { expect };

/** Waits for an email to reach Mailpit and returns its plain-text body. */
export async function waitForEmail(to: string, subject: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
  while (Date.now() < deadline) {
    const search = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as { messages: { ID: string }[] };
    if (search.messages.length) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`)).json()) as { Text: string };
      return message.Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email "${subject}" to ${to} within ${timeoutMs / 1000}s`);
}

/** Fails if the page scrolls sideways (something is wider than the screen). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(1);
}

/** A tiny valid PDF, for upload tests. */
export function samplePdf(text = "E2E test document") {
  const content = `BT /F1 18 Tf 30 60 Td (${text}) Tj ET`;
  return Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
      `4 0 obj<</Length ${content.length}>>stream`,
      content,
      "endstream endobj",
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
      "trailer<</Root 1 0 R>>",
      "%%EOF",
    ].join("\n"),
  );
}
