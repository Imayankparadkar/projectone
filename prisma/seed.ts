/**
 * Seed script — creates fictional demo data.
 * Run with: npx prisma db seed
 *
 * Creates: 1 admin, 1 user, 3 centres, 5 tests, varied prices.
 * All data is fictional and for demonstration purposes only.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function applyRawSqlConstraints() {
  console.log('🔧 Applying raw SQL constraints…');
  
  // Add CHECK constraints (price > 0, amount > 0)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "centre_tests" ADD CONSTRAINT "centre_tests_price_check" CHECK (price > 0) NOT VALID;
  `).catch(() => {}); // Ignore if already exists

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amount_check" CHECK (amount > 0) NOT VALID;
  `).catch(() => {});

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK (amount > 0) NOT VALID;
  `).catch(() => {});

  // Add partial unique index for booking slots
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "bookings_slot_idx" 
    ON "bookings" ("centre_test_id", "appointment_at") 
    WHERE status IN ('PENDING', 'CONFIRMED');
  `).catch(() => {});
}

async function main() {
  await applyRawSqlConstraints();
  
  console.log('🌱 Seeding database…');

  // ── Users ──
  const adminHash = await bcrypt.hash('admin1234', 10);
  const userHash = await bcrypt.hash('user1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@eve.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@eve.com',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@eve.com' },
    update: {},
    create: {
      name: 'Regular User',
      email: 'user@eve.com',
      passwordHash: userHash,
      role: Role.USER,
    },
  });

  console.log(`  ✅ Users: ${admin.email} (ADMIN), ${user.email} (USER)`);

  // ── Diagnostic Centres (fictional) ──
  const centres = await Promise.all([
    prisma.diagnosticCentre.create({
      data: { name: 'MedScan Central Lab', location: 'Mumbai, Maharashtra' },
    }),
    prisma.diagnosticCentre.create({
      data: { name: 'HealthFirst Diagnostics', location: 'Delhi, NCR' },
    }),
    prisma.diagnosticCentre.create({
      data: { name: 'PrimeCare Testing Centre', location: 'Bangalore, Karnataka' },
    }),
  ]);

  console.log(`  ✅ Centres: ${centres.map((c) => c.name).join(', ')}`);

  // ── Diagnostic Tests ──
  const tests = await Promise.all([
    prisma.diagnosticTest.create({
      data: { name: 'Complete Blood Count', code: 'CBC', description: 'Measures different components of blood' },
    }),
    prisma.diagnosticTest.create({
      data: { name: 'Lipid Profile', code: 'LIPID', description: 'Measures cholesterol and triglycerides' },
    }),
    prisma.diagnosticTest.create({
      data: { name: 'Thyroid Function Test', code: 'TFT', description: 'Measures thyroid hormone levels' },
    }),
    prisma.diagnosticTest.create({
      data: { name: 'Liver Function Test', code: 'LFT', description: 'Evaluates liver health and function' },
    }),
    prisma.diagnosticTest.create({
      data: { name: 'HbA1c', code: 'HBA1C', description: 'Average blood sugar over past 2-3 months' },
    }),
  ]);

  console.log(`  ✅ Tests: ${tests.map((t) => t.code).join(', ')}`);

  // ── Centre-Test Prices (varied per centre) ──
  // Same test, different prices at different centres
  const priceMatrix = [
    // [centreIndex, testIndex, price]
    [0, 0, 450],   // MedScan – CBC
    [0, 1, 1200],  // MedScan – Lipid
    [0, 2, 850],   // MedScan – TFT
    [0, 3, 750],   // MedScan – LFT
    [0, 4, 600],   // MedScan – HbA1c
    [1, 0, 500],   // HealthFirst – CBC
    [1, 1, 1100],  // HealthFirst – Lipid
    [1, 2, 900],   // HealthFirst – TFT
    [1, 3, 800],   // HealthFirst – LFT
    [1, 4, 650],   // HealthFirst – HbA1c
    [2, 0, 400],   // PrimeCare – CBC
    [2, 1, 1300],  // PrimeCare – Lipid
    [2, 2, 800],   // PrimeCare – TFT
    [2, 3, 700],   // PrimeCare – LFT
    [2, 4, 550],   // PrimeCare – HbA1c
  ] as const;

  for (const [ci, ti, price] of priceMatrix) {
    await prisma.centreTest.create({
      data: {
        centreId: centres[ci].id,
        testId: tests[ti].id,
        price,
      },
    });
  }

  console.log(`  ✅ Centre-Test prices: ${priceMatrix.length} entries`);
  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
