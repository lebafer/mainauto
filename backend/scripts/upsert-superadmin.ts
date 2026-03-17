import { prisma } from "../src/prisma";
import { upsertCredentialUser } from "../src/lib/auth-users";

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const username = getArg("--username") || process.env.ADMIN_USERNAME;
  const password = getArg("--password") || process.env.ADMIN_PASSWORD;
  const email = getArg("--email") || process.env.ADMIN_EMAIL;
  const name = getArg("--name") || process.env.ADMIN_NAME || "Superadmin";

  if (!username || !password) {
    console.error(
      "Usage: bun run scripts/upsert-superadmin.ts --username <username> --password <password> [--email <email>] [--name <name>]"
    );
    process.exit(1);
  }

  const user = await upsertCredentialUser({
    username,
    password,
    email: email || `${username}@admin.local`,
    name,
    platformRole: "platform_super_admin",
  });

  console.info(
    `[admin] upserted_superadmin username=${user.username ?? "-"} email=${user.email} id=${user.id}`
  );
}

main()
  .catch((error) => {
    console.error("[admin] failed_to_upsert_superadmin", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
