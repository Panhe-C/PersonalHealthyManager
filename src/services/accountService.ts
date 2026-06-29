import { prisma } from "@/src/db/client";
import { verifyPassword } from "@/src/auth/password";

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
