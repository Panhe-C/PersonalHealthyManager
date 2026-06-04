import { hashPassword } from "@/src/auth/password";
import { prisma } from "@/src/db/client";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "healthy-body-demo";
const DEMO_TIMEZONE = "Asia/Shanghai";

async function main() {
  const passwordHash = hashPassword(DEMO_PASSWORD);

  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      passwordHash,
      timezone: DEMO_TIMEZONE
    },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      timezone: DEMO_TIMEZONE
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
