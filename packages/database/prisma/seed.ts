/**
 * @file seed.ts
 * @description Entry point for `pnpm --filter database db:seed`. Creates a mock workspace with one
 * member in every role, a board, columns and cards for development and test environments only.
 *
 * The script is idempotent: it replaces the demo workspace (identified by its slug) on every run,
 * so repeated runs converge on the same data instead of piling up duplicates.
 */
import { createPrismaClient, Priority, Role, type PrismaClient } from "../src/index";

/** Slug that identifies the demo tenant; the only workspace this script ever deletes. */
const DEMO_WORKSPACE_SLUG = "demo-workspace";

/**
 * Fixed Lexorank-style keys with wide gaps between them. The real Lexorank utilities arrive in
 * Stage 2, so the seed uses literals that already sort correctly under the "C" collation and
 * leave room for midpoint inserts.
 */
const RANKS = ["g", "n", "t"] as const;

/**
 * Returns the seed rank for a zero-based position.
 *
 * @param index - Position within the parent; must be below {@link RANKS}.length.
 * @throws If the demo data outgrows the fixed rank table.
 */
function rankAt(index: number): string {
  const rank = RANKS[index];
  if (rank === undefined) throw new Error(`No seed rank defined for index ${index}.`);
  return rank;
}

/** One demo user per role, so RBAC can be exercised by logging in as each of them. */
const DEMO_MEMBERS: ReadonlyArray<{ email: string; name: string; role: Role }> = [
  { email: "owner@demo.test", name: "Olivia Owner", role: Role.OWNER },
  { email: "admin@demo.test", name: "Adam Admin", role: Role.ADMIN },
  { email: "member@demo.test", name: "Maya Member", role: Role.MEMBER },
  { email: "viewer@demo.test", name: "Victor Viewer", role: Role.VIEWER },
];

/** Column titles and the card titles seeded into each, in display order. */
const DEMO_COLUMNS: ReadonlyArray<{ title: string; cards: readonly string[] }> = [
  { title: "To Do", cards: ["Draft project brief", "Set up CI", "Design login screen"] },
  { title: "In Progress", cards: ["Implement auth API", "Review database schema"] },
  { title: "Done", cards: ["Create repository"] },
];

/**
 * Replaces the demo workspace with freshly seeded data.
 *
 * Runs in one transaction so a failure never leaves a half-seeded tenant behind.
 *
 * @param prisma - Client to seed through (injected so tests can pass their own).
 * @returns Resolves when the transaction commits.
 * @throws Prisma errors if the database is unreachable or the schema has not been migrated.
 * @remarks Side effects: deletes the existing demo workspace (cascading to its boards, columns,
 * cards and memberships) and upserts the demo users by email. Users are kept across runs because
 * `Card.creatorId` restricts user deletion.
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspace.deleteMany({ where: { slug: DEMO_WORKSPACE_SLUG } });

    const users = await Promise.all(
      DEMO_MEMBERS.map((member) =>
        tx.user.upsert({
          where: { email: member.email },
          update: { name: member.name },
          create: { email: member.email, name: member.name },
        }),
      ),
    );
    const owner = users[0];
    const member = users[2];
    if (!owner || !member) throw new Error("Seed invariant violated: demo users missing.");

    const workspace = await tx.workspace.create({
      data: {
        name: "Demo Workspace",
        slug: DEMO_WORKSPACE_SLUG,
        members: {
          create: users.map((user, index) => ({
            // Upserts above preserve DEMO_MEMBERS order, so indexes line up.
            role: DEMO_MEMBERS[index]?.role ?? Role.VIEWER,
            userId: user.id,
          })),
        },
      },
    });

    const board = await tx.board.create({
      data: { title: "Product Launch", position: rankAt(0), workspaceId: workspace.id },
    });

    for (const [columnIndex, column] of DEMO_COLUMNS.entries()) {
      const createdColumn = await tx.column.create({
        data: { title: column.title, position: rankAt(columnIndex), boardId: board.id },
      });
      await tx.card.createMany({
        data: column.cards.map((title, cardIndex) => ({
          title,
          position: rankAt(cardIndex),
          priority: cardIndex === 0 ? Priority.HIGH : Priority.MEDIUM,
          columnId: createdColumn.id,
          creatorId: owner.id,
          assigneeId: member.id,
        })),
      });
    }
  });
}

/**
 * Script entry: guards against production, seeds, and always disconnects the client.
 *
 * @throws If `NODE_ENV` is `production` or `DATABASE_URL` is not set.
 */
async function main(): Promise<void> {
  // Seed data must never reach a real tenant database (see docs/database-design.md §10).
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set; copy apps/api-server/.env.example and export it.");
  }

  const prisma = createPrismaClient();
  try {
    await seed(prisma);
    console.info(`Seeded "${DEMO_WORKSPACE_SLUG}" with ${DEMO_MEMBERS.length} members.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
