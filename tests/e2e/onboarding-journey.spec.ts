import { BASE_URL, PASSWORD } from "./env";
import { emailOf, expect, samplePdf, test, waitForEmail } from "./helpers";

// The core journey, in order: HR adds a new hire → welcome email → new hire creates a login →
// HR starts onboarding → new hire does a task and uploads a document → HR approves it.
test.describe.configure({ mode: "serial" });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

test("a new hire goes from being added to an approved document", async ({ as, browser }) => {
  // 1. HR (Engineering) adds Nisha.
  const hr = await as("hari");
  await hr.goto("/employees/new");
  await hr.getByLabel("First name").fill("Nisha");
  await hr.getByLabel("Last name").fill("Rao");
  await hr.getByLabel("Work email").fill(emailOf("nisha"));
  await hr.getByLabel("Joining date").fill(today);
  await hr.getByRole("combobox", { name: "Department" }).click();
  await hr.getByRole("option", { name: "Engineering" }).click();
  await hr.getByRole("button", { name: "Add employee" }).click();
  await expect(hr.getByRole("heading", { level: 1, name: "Nisha Rao" })).toBeVisible();
  await expect(hr).toHaveURL(/\/employees\/[\w-]+$/);

  // 2. The welcome email arrives with a one-time sign-up link (and never a password).
  const body = await waitForEmail(emailOf("nisha"), "Welcome to Embark");
  const link = body.match(new RegExp(`${BASE_URL}/sign-up\\?token=[\\w-]+`))?.[0];
  expect(link, "sign-up link in the welcome email").toBeTruthy();
  expect(body).not.toContain(PASSWORD);

  // 3. Nisha creates her login from the link and lands on her dashboard.
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.30.0.1" } });
  const hire = await context.newPage();
  await hire.goto(link!);
  await expect(hire.getByRole("heading", { name: "Welcome, Nisha" })).toBeVisible();
  await hire.getByLabel("Choose a password").fill(PASSWORD);
  await hire.getByLabel("Confirm password").fill(PASSWORD);
  await hire.getByRole("button", { name: "Create login" }).click();
  await expect(hire).toHaveURL(/\/dashboard$/);

  // The link only works once.
  const reused = await browser.newPage();
  await reused.goto(link!);
  await expect(reused.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await reused.close();

  // 4. HR starts her onboarding with the standard template.
  await hr.goto("/onboarding/new");
  await hr.getByRole("combobox", { name: "New hire" }).click();
  await hr.getByRole("option", { name: /Nisha Rao/ }).click();
  await hr.getByRole("button", { name: "Start onboarding" }).click();
  await expect(hr.getByRole("heading", { level: 1, name: "Nisha Rao's onboarding" })).toBeVisible();
  await expect(hr.getByRole("link", { name: /Read the employee handbook/ })).toBeVisible();

  // 5. Nisha sees her tasks and finishes one.
  await hire.goto("/tasks/assigned-to-me");
  await hire.getByRole("link", { name: /Read the employee handbook/ }).click();
  await hire.getByRole("button", { name: "Mark done" }).click();
  await expect(hire.getByText("Done", { exact: true }).first()).toBeVisible();

  // 6. She uploads her signed offer letter on its task.
  await hire.goto("/tasks/assigned-to-me");
  await hire.getByRole("link", { name: /Upload signed offer letter/ }).click();
  await hire.locator('input[type="file"]').setInputFiles({ name: "offer-letter.pdf", mimeType: "application/pdf", buffer: samplePdf("Signed offer letter") });
  await hire.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(hire.getByText("Uploaded. The task is done and waiting for HR to review the document.")).toBeVisible();

  // 7. HR reviews and approves it; Nisha sees it approved.
  await hr.goto("/documents?status=PENDING");
  await hr.getByRole("link", { name: /Signed offer letter/ }).first().click();
  await expect(hr.getByText("Nisha Rao").first()).toBeVisible();
  await hr.getByRole("button", { name: "Approve" }).click();
  await expect(hr.getByText("Approved").first()).toBeVisible();

  await hire.goto("/documents");
  await expect(hire.getByRole("row", { name: /Signed offer letter/ }).getByText("Approved")).toBeVisible();
  await context.close();
});
