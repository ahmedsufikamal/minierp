import { disconnectPrisma, prisma } from "./prisma-client.mjs";

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true },
  });

  let demotedOwners = 0;
  let promotedOwners = 0;

  for (const company of companies) {
    const [ownerRole, adminRole, memberships] = await Promise.all([
      prisma.iamRole.findUnique({
        where: { companyId_name: { companyId: company.id, name: "OWNER" } },
        select: { id: true },
      }),
      prisma.iamRole.findUnique({
        where: { companyId_name: { companyId: company.id, name: "ADMIN" } },
        select: { id: true },
      }),
      prisma.companyMembership.findMany({
        where: { companyId: company.id, status: "ACTIVE" },
        orderBy: [{ joinedAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, role: true },
      }),
    ]);

    const activeOwnerMemberships = memberships.filter((membership) => membership.role === "OWNER");
    const ownerToKeep = activeOwnerMemberships[0];
    const ownersToDemote = activeOwnerMemberships.slice(1);

    for (const membership of ownersToDemote) {
      await prisma.companyMembership.update({
        where: { id: membership.id },
        data: {
          role: "ADMIN",
          roleId: adminRole?.id ?? null,
        },
      });
      demotedOwners += 1;
    }

    if (!ownerToKeep) {
      const promoteCandidate = memberships[0];
      if (promoteCandidate) {
        await prisma.companyMembership.update({
          where: { id: promoteCandidate.id },
          data: {
            role: "OWNER",
            roleId: ownerRole?.id ?? null,
          },
        });
        promotedOwners += 1;
      }
    } else if (!ownerRole?.id) {
      await prisma.companyMembership.update({
        where: { id: ownerToKeep.id },
        data: { roleId: null },
      });
    }
  }

  console.log("Master admin backfill complete", {
    companies: companies.length,
    demotedOwners,
    promotedOwners,
  });
}

main()
  .catch((error) => {
    console.error("Master admin backfill failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
