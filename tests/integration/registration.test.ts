import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveEmployee, createEmployee, inviteFromDatabaseAdmin, resendWelcomeEmail } from "@/features/employees/service";
import { auth } from "@/lib/auth/auth";
import { createInvite, getInviteDetails, registerWithInvite } from "@/lib/auth/registration";
import { loadUserContext } from "@/lib/auth/rbac";
import { deliverEmail } from "@/lib/email/deliver";
import { createPerson, prisma, resetData } from "../helpers/db";

const PASSWORD = "Correct-Horse-1";
const form = (token: string) => ({ token, password: PASSWORD, confirmPassword: PASSWORD });
const sent = vi.mocked(deliverEmail);

/** HR adds Priya; returns the token from the welcome email. */
async function addPriya(roleKey: "EMPLOYEE" | "REPORTING_MANAGER" = "EMPLOYEE") {
  const { user: hr } = await createPerson("HR_MANAGER");
  sent.mockClear();
  const employee = await createEmployee(hr, {
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya@example.com",
    joiningDate: "2026-11-02",
    roleKey,
  });
  const token = sent.mock.calls[0][0].text.match(/token=([\w-]+)/)![1];
  return { hr, employee, token };
}

beforeEach(resetData);

describe("registration via welcome link", () => {
  it("creates a verified login with the HR-chosen role that can sign in", async () => {
    const { employee, token } = await addPriya("REPORTING_MANAGER");
    expect(await getInviteDetails(token)).toMatchObject({ firstName: "Priya", email: "priya@example.com" });

    const { userId } = await registerWithInvite(form(token));
    const login = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(login).toMatchObject({ email: "priya@example.com", name: "Priya Sharma", emailVerified: true });
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).userId).toBe(userId);
    expect((await loadUserContext(userId))?.roles).toEqual(["REPORTING_MANAGER"]);

    const session = await auth.api.signInEmail({ body: { email: "priya@example.com", password: PASSWORD } });
    expect(session.user.id).toBe(userId);
    await expect(
      auth.api.signInEmail({ body: { email: "priya@example.com", password: "wrong-password" } }),
    ).rejects.toThrow();
  });

  it("only works once", async () => {
    const { token } = await addPriya();
    await registerWithInvite(form(token));
    await expect(registerWithInvite(form(token))).rejects.toThrow("invalid or has expired");
    expect(await getInviteDetails(token)).toBeNull();
  });

  it("rejects expired, unknown, replaced, and archived-employee links", async () => {
    const { hr, employee, token } = await addPriya();
    await expect(registerWithInvite(form("not-a-real-token"))).rejects.toThrow("invalid or has expired");

    await prisma.employeeInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(registerWithInvite(form(token))).rejects.toThrow("invalid or has expired");

    await resendWelcomeEmail(hr, employee.id);
    const fresh = sent.mock.calls.at(-1)![0].text.match(/token=([\w-]+)/)![1];
    expect(await getInviteDetails(token)).toBeNull(); // the old link stopped working
    expect(await getInviteDetails(fresh)).not.toBeNull();

    const { user: admin } = await createPerson("HR_ADMIN");
    await archiveEmployee(admin, employee.id);
    await expect(registerWithInvite(form(fresh))).rejects.toThrow("invalid or has expired");
  });

  it("validates the password", async () => {
    const { token } = await addPriya();
    await expect(registerWithInvite({ token, password: "short", confirmPassword: "short" })).rejects.toThrow();
    await expect(registerWithInvite({ token, password: PASSWORD, confirmPassword: "different-1" })).rejects.toThrow();
  });

  it("blocks Better Auth's public sign-up endpoint entirely", async () => {
    await addPriya();
    await expect(
      auth.api.signUpEmail({ body: { email: "priya@example.com", password: PASSWORD, name: "Squatter" } }),
    ).rejects.toThrow();
    await expect(
      auth.api.signUpEmail({ body: { email: "stranger@example.com", password: PASSWORD, name: "Stranger" } }),
    ).rejects.toThrow();
    expect(await prisma.user.count({ where: { email: { in: ["priya@example.com", "stranger@example.com"] } } })).toBe(0);
  });

  it("stores only a hash of the token", async () => {
    const { employee, token } = await addPriya();
    const stored = await prisma.employeeInvite.findFirstOrThrow({ where: { employeeId: employee.id } });
    expect(stored.tokenHash).not.toContain(token);
    expect(await createInvite(prisma, employee.id, null)).not.toBe(token);
  });
});

describe("invites sent by the database admin (npm run invite)", () => {
  it("lets someone added directly in Postgres, like the first HR Admin, create their login", async () => {
    await prisma.employee.create({
      data: { employeeCode: "DBA-1", firstName: "Ira", lastName: "Admin", email: "ira@example.com", joiningDate: new Date("2026-01-05"), roleKey: "HR_ADMIN" },
    });
    sent.mockClear();
    const result = await inviteFromDatabaseAdmin("IRA@example.com");
    expect(result).toMatchObject({ email: "ira@example.com", emailed: true });
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][0].to).toBe("ira@example.com");

    const token = result.url.match(/token=([\w-]+)/)![1];
    const { userId } = await registerWithInvite(form(token));
    expect((await loadUserContext(userId))?.roles).toEqual(["HR_ADMIN"]);
  });

  it("refuses unknown, archived, and already-registered people", async () => {
    await expect(inviteFromDatabaseAdmin("nobody@example.com")).rejects.toThrow("No employee");
    const { employee } = await createPerson("EMPLOYEE");
    await expect(inviteFromDatabaseAdmin(employee.email)).rejects.toThrow("already created their login");
  });
});
