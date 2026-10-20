import { vi } from "vitest";

// No real email or queue jobs in tests; assert on the deliverEmail mock instead.
vi.mock("@/lib/email/deliver", () => ({ deliverEmail: vi.fn().mockResolvedValue("queued") }));
vi.mock("@/lib/email/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
