import { expect, ids, test } from "./helpers";

test("HR can tick off a task and then add one by hand on the same page", async ({ as }) => {
  const hari = await as("hari");
  await hari.goto(`/onboarding/${ids().processes.bina}`);
  const toggle = hari.getByRole("checkbox", { name: 'Mark "Prepare laptop and accounts" done' });
  await toggle.click();
  await expect(hari.getByRole("checkbox", { name: 'Reopen "Prepare laptop and accounts"' })).toBeVisible();

  // Straight after the toggle (its toast still showing), the Add task dialog must open.
  await hari.getByRole("button", { name: "Add task" }).click();
  const dialog = hari.getByRole("dialog", { name: "Add a task" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Task").fill("Order an extra monitor");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
  await expect(hari.getByRole("link", { name: "Order an extra monitor" })).toBeVisible();
});

test("a new hire can open their own task but not a colleague's", async ({ as }) => {
  const anil = await as("anil");
  await anil.goto(`/tasks/${ids().tasks.anilHandbook}`);
  await expect(anil.getByRole("button", { name: "Mark done" })).toBeVisible();
  // Bina's task in the same space is invisible to Anil.
  await anil.goto(`/tasks/${ids().tasks.binaHandbook}`);
  await expect(anil.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
