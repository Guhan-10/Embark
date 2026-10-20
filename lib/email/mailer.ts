import nodemailer from "nodemailer";
import { env } from "@/lib/env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

export type Email = { to: string; subject: string; text: string; html: string };

export async function sendEmail(email: Email) {
  await transporter.sendMail({ from: env.MAIL_FROM, ...email });
}
