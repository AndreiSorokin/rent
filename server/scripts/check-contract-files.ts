/**
 * Audits Contract records against files actually present in uploads/.
 * Run on the server host (or inside the `server` container) with access
 * to both DATABASE_URL and the uploads/ directory, e.g.:
 *
 *   docker compose exec server npx ts-node -r tsconfig-paths/register scripts/check-contract-files.ts
 *
 * or locally:
 *
 *   npx ts-node scripts/check-contract-files.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany({
    orderBy: { uploadedAt: 'asc' },
    include: {
      pavilionLease: {
        include: {
          pavilion: {
            include: { store: true },
          },
        },
      },
    },
  });

  const missing: typeof contracts = [];
  const present: typeof contracts = [];

  for (const contract of contracts) {
    const absolutePath = path.join(process.cwd(), contract.filePath.replace(/^\//, ''));
    if (fs.existsSync(absolutePath)) {
      present.push(contract);
    } else {
      missing.push(contract);
    }
  }

  console.log(`Total contracts: ${contracts.length}`);
  console.log(`Present on disk: ${present.length}`);
  console.log(`Missing on disk: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nMissing files:');
    for (const c of missing) {
      const store = c.pavilionLease.pavilion.store.name;
      const pavilion = c.pavilionLease.pavilion.number;
      const tenant = c.pavilionLease.tenantName;
      console.log(
        `  contract id=${c.id} | store="${store}" | pavilion="${pavilion}" | tenant="${tenant}" | contractNumber=${c.contractNumber ?? '-'} | fileName="${c.fileName}" | uploadedAt=${c.uploadedAt.toISOString()} | filePath=${c.filePath}`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
