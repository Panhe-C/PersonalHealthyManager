import { hashPassword } from "@/src/auth/password";
import { prisma } from "@/src/db/client";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = required("HBM_OWNER_EMAIL").toLowerCase();
  const password = required("HBM_OWNER_PASSWORD");
  const timezone = process.env.HBM_OWNER_TIMEZONE?.trim() || "Asia/Shanghai";

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("HBM_OWNER_EMAIL must be a valid email address");
  if (password.length < 12 || password.length > 128) {
    throw new Error("HBM_OWNER_PASSWORD must be between 12 and 128 characters");
  }
  const passwordHash = hashPassword(password);

  const account = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, timezone },
    create: { email, passwordHash, timezone },
    select: { email: true, timezone: true }
  });

  console.log(`Owner account ready: ${account.email} (${account.timezone})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
