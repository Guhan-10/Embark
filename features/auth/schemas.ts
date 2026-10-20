import { z } from "zod";

const email = z.email("Enter a valid email address").trim().toLowerCase();
const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

/** Creating a login from the welcome-email link. The email comes from the link, not the form. */
export const registerSchema = z
  .object({ token: z.string().min(1, "This sign-up link is incomplete"), password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
