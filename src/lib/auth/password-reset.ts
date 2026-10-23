import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

const RESET_TTL_MINUTES = 30;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function sendResetEmail(email: string, url: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !port || !user || !pass || !from) return false;

  const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port !== 465, auth: { user, pass } });
  try {
    await transport.sendMail({
      from,
      to: email,
      subject: "Reset your CityPlaza password",
      text: `Use this link within ${RESET_TTL_MINUTES} minutes to reset your password: ${url}`,
      html: `<p>A password reset was requested for your CityPlaza account.</p><p><a href="${url}">Reset password</a></p><p>This link expires in ${RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
    });
  } finally {
    await transport.close();
  }
  return true;
}

export async function createPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt } });

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash: digest(token) } });
    return;
  }
  const delivered = await sendResetEmail(user.email, `${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
  if (!delivered) await prisma.passwordResetToken.deleteMany({ where: { tokenHash: digest(token) } });
}

export async function consumePasswordReset(token: string, password: string) {
  const tokenHash = digest(token);
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new Error("This reset link is invalid or has expired.");
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("This reset link is invalid or has expired.");

    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, id: { not: reset.id } } });
  });
}
