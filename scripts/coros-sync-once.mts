/** One-shot: run the COROS settings sync for the real user against dev.db. */
import { prisma } from "../src/db/client";
import { syncCorosFromSettings } from "../src/services/syncService";

const user = await prisma.user.findFirst({ where: { email: "983353213@qq.com" }, select: { id: true } });
if (!user) throw new Error("user not found");

const result = await syncCorosFromSettings(user.id);
console.log("sync result:", result);

const rows = await prisma.recoveryRecord.findMany({
  orderBy: { date: "desc" },
  take: 6,
  select: { date: true, recoveryPercent: true, hrvMs: true, restingHeartRateBpm: true, stressLevel: true }
});
console.table(rows);
await prisma.$disconnect();
