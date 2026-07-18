import { prisma } from "@/src/db/client";
import { hashPassword, verifyPassword } from "@/src/auth/password";

export async function getUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, timezone: true, createdAt: true }
  });
  if (!user) throw new Error("Account not found");
  return user;
}

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new Error("Account not found");
  if (!verifyPassword(currentPassword, user.passwordHash)) throw new Error("Invalid password");
  if (verifyPassword(newPassword, user.passwordHash)) throw new Error("New password must be different");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPassword) } }),
    prisma.session.deleteMany({ where: { userId } })
  ]);
}

/**
 * Permanently deletes a user account. Deletes the NoAction-referenced children
 * (training completions + training tasks) first so the cascaded User delete
 * never trips a foreign-key check on Postgres (TrainingTask.goal and
 * TrainingCompletion.linkedActivity use onDelete: NoAction). Everything else
 * cascades from the User delete.
 *
 * Verifies the password before deleting so a leaked Bearer token alone cannot
 * wipe an account.
 */
export async function deleteUserAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new Error("Account not found");
  if (!verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid password");
  }

  await prisma.$transaction([
    prisma.trainingCompletion.deleteMany({ where: { userId } }),
    prisma.trainingTask.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } })
  ]);
}
