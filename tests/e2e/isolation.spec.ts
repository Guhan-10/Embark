import { expect, ids, test } from "./helpers";

// Each department's HR space is separate, and inside a space people only see what their role allows.
test.describe("HR spaces never overlap", () => {
  test("Design's HR can't see Engineering's people, onboarding, or tasks", async ({ as }) => {
    const meera = await as("meera");
    await meera.goto("/employees");
    await expect(meera.getByRole("link", { name: /Chen Li/ })).toBeVisible();
    await expect(meera.getByText("Anil Kumar")).toHaveCount(0);
    await expect(meera.getByText("Bina Das")).toHaveCount(0);

    for (const url of [`/employees/${ids().employees.anil}`, `/onboarding/${ids().processes.anil}`, `/tasks/${ids().tasks.anilHandbook}`]) {
      await meera.goto(url);
      await expect(meera.getByRole("heading", { name: "Page not found" }), url).toBeVisible();
    }
  });

  test("Engineering's HR can't see Design's people", async ({ as }) => {
    const hari = await as("hari");
    await hari.goto("/employees");
    await expect(hari.getByRole("link", { name: /Anil Kumar/ })).toBeVisible();
    await expect(hari.getByText("Chen Li")).toHaveCount(0);
    await hari.goto(`/tasks/${ids().tasks.chenHandbook}`);
    await expect(hari.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("documents stay inside their space", async ({ as }) => {
    const chenDocument = ids().documents.chen;
    const meera = await as("meera");
    expect((await meera.request.get(`/api/documents/${chenDocument}/download`)).status()).toBe(200);

    const hari = await as("hari");
    expect((await hari.request.get(`/api/documents/${chenDocument}/download`)).status()).toBe(404);
    await hari.goto(`/documents/${chenDocument}`);
    await expect(hari.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const anil = await as("anil");
    expect((await anil.request.get(`/api/documents/${chenDocument}/download`)).status()).toBe(404);
  });
});

test.describe("visibility inside a space", () => {
  test("a new hire sees colleagues' progress but not their tasks or profiles", async ({ as }) => {
    const anil = await as("anil");
    await anil.goto("/dashboard");
    const team = anil.getByRole("region", { name: "Your team's progress" });
    await expect(team.getByText("Bina Das")).toBeVisible();
    await expect(team.getByText("Chen Li")).toHaveCount(0);

    for (const url of [`/tasks/${ids().tasks.binaHandbook}`, `/tasks/${ids().tasks.chenHandbook}`, `/employees/${ids().employees.bina}`]) {
      await anil.goto(url);
      await expect(anil.getByRole("heading", { name: "Page not found" }), url).toBeVisible();
    }
  });

  test("a new hire can't open HR pages", async ({ as }) => {
    const anil = await as("anil");
    for (const url of ["/employees/new", "/reports", "/settings", "/tasks"]) {
      await anil.goto(url);
      await expect(anil, url).not.toHaveURL(new RegExp(`${url}$`));
    }
  });

  test("a reporting manager sees their direct reports only", async ({ as }) => {
    const rahul = await as("rahul");
    await rahul.goto("/employees");
    await expect(rahul.getByRole("link", { name: /Anil Kumar/ })).toBeVisible();
    await expect(rahul.getByRole("link", { name: /Bina Das/ })).toBeVisible();
    await expect(rahul.getByText("Chen Li")).toHaveCount(0);
  });
});
