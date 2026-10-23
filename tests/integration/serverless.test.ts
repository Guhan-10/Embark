import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchNotificationEmails } from "@/lib/jobs/notification-emails";
import { deliverEmail } from "@/lib/email/deliver";
import { createPerson, prisma, resetData } from "../helpers/db";

const sent = vi.mocked(deliverEmail);

beforeEach(resetData);

describe("hosting without a worker (e.g. Vercel)", () => {
  it("sends each pending notification e-mail once, even when two dispatchers run at the same time", async () => {
    const { user } = await createPerson("EMPLOYEE");
    await prisma.notification.create({ data: { userId: user.id, type: "SYSTEM", title: "Welcome", emailPending: true } });
    sent.mockClear();

    await Promise.all([dispatchNotificationEmails(), dispatchNotificationEmails()]);

    expect(sent).toHaveBeenCalledTimes(1);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: user.id } });
    expect(n.emailPending).toBe(false);
    expect(n.emailedAt).not.toBeNull();
  });

  it("puts a notification back to pending when sending fails", async () => {
    const { user } = await createPerson("EMPLOYEE");
    await prisma.notification.create({ data: { userId: user.id, type: "SYSTEM", title: "Welcome", emailPending: true } });
    sent.mockRejectedValueOnce(new Error("SMTP down"));

    const result = await dispatchNotificationEmails();

    expect(result.failed).toBe(1);
    expect((await prisma.notification.findFirstOrThrow({ where: { userId: user.id } })).emailPending).toBe(true);
  });

  it("runs the daily cron endpoint only with the secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-0123456789");
    vi.resetModules();
    const { GET } = await import("@/app/api/cron/daily/route");
    const call = (auth?: string) => GET(new Request("http://localhost/api/cron/daily", { headers: auth ? { authorization: auth } : {} }));

    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret")).status).toBe(401);
    const ok = await call("Bearer test-cron-secret-0123456789");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
    vi.unstubAllEnvs();
  });
});
