import { BASE_URL, PASSWORD } from "./env";
import { emailOf, expect, test } from "./helpers";

test.describe("signing in", () => {
  test("signed-out visitors are sent to sign-in, then back to where they were going", async ({ browser }) => {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.20.0.1" } });
    const page = await context.newPage();
    await page.goto("/tasks/assigned-to-me");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Ftasks%2Fassigned-to-me/);

    await page.getByLabel("Work email").fill(emailOf("anil"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/tasks\/assigned-to-me$/);
    await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
    await context.close();
  });

  test("a wrong password is rejected with a clear message", async ({ browser }) => {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.20.0.2" } });
    const page = await context.newPage();
    await page.goto("/sign-in");
    await page.getByLabel("Work email").fill(emailOf("anil"));
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
    await context.close();
  });
});

test.describe("nobody can create their own login", () => {
  test("the sign-up page needs a welcome-email link", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "You need an invitation" })).toBeVisible();
    await expect(page.getByLabel("Choose a password")).toHaveCount(0);

    await page.goto("/sign-up?token=made-up-token");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  });

  test("public sign-up is switched off in the API", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { name: "Walk In", email: "walk.in@example.com", password: "Walk-In-Pass-1" },
      headers: { Origin: BASE_URL, "x-forwarded-for": "10.20.0.3" },
    });
    expect(response.ok()).toBe(false);

    const signIn = await request.post("/api/auth/sign-in/email", {
      data: { email: "walk.in@example.com", password: "Walk-In-Pass-1" },
      headers: { Origin: BASE_URL, "x-forwarded-for": "10.20.0.3" },
    });
    expect(signIn.ok()).toBe(false);
  });
});
