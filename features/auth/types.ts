import type { z } from "zod";
import type {
  forgotPasswordSchema,
  resetPasswordSchema,
  registerSchema,
  signInSchema,
} from "./schemas";

export type { CurrentUser } from "@/lib/auth/rbac";

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
