import { expect, expectNoHorizontalScroll, ids, test } from "./helpers";

// Runs in the "mobile" project (a phone-sized screen).
test("a new hire can find their way around on a phone", async ({ as }) => {
  const page = await as("bina");
  await page.goto("/dashboard");
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Tasks" }).click();
  await expect(page).toHaveURL(/\/tasks\/assigned-to-me$/);
  await expectNoHorizontalScroll(page);

  await page.goto(`/tasks/${ids().tasks.binaHandbook}`);
  await expect(page.getByRole("button", { name: "Mark done" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/documents");
  await expectNoHorizontalScroll(page);
});

test("HR pages fit a phone screen (wide tables scroll inside their card)", async ({ as }) => {
  const page = await as("hari");
  for (const url of ["/dashboard", "/employees", "/onboarding", `/onboarding/${ids().processes.anil}`, "/tasks", "/documents", "/reports", "/notifications"]) {
    await page.goto(url);
    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});
