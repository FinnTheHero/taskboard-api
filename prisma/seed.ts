import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const DEMO_PASSWORD = "demo1234";
const ALICE_EMAIL = "alice@demo.com";
const BOB_EMAIL = "bob@demo.com";
const ACME_CODE = "100001";
const BETA_CODE = "200002";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function deleteBoardCascade(boardId: string) {
  await db.notification.deleteMany({
    where: { task: { column: { boardId } } },
  });
  await db.comment.deleteMany({
    where: { task: { column: { boardId } } },
  });
  await db.task.deleteMany({
    where: { column: { boardId } },
  });
  await db.boardMember.deleteMany({ where: { boardId } });
  await db.board.delete({ where: { id: boardId } });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const pastDeadline = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const futureDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const alice = await db.user.upsert({
    where: { email: ALICE_EMAIL },
    update: { name: "Alice", passwordHash },
    create: { name: "Alice", email: ALICE_EMAIL, passwordHash },
  });

  const bob = await db.user.upsert({
    where: { email: BOB_EMAIL },
    update: { name: "Bob", passwordHash },
    create: { name: "Bob", email: BOB_EMAIL, passwordHash },
  });

  await db.groupMember.deleteMany({ where: { userId: { in: [alice.id, bob.id] } } });

  const acme = await db.group.upsert({
    where: { joinCode: ACME_CODE },
    update: { name: "Acme Corp" },
    create: { name: "Acme Corp", joinCode: ACME_CODE },
  });

  await db.group.upsert({
    where: { joinCode: BETA_CODE },
    update: { name: "Beta Labs" },
    create: { name: "Beta Labs", joinCode: BETA_CODE },
  });

  await db.groupMember.upsert({
    where: { userId: alice.id },
    update: { groupId: acme.id, role: "MANAGER" },
    create: { groupId: acme.id, userId: alice.id, role: "MANAGER" },
  });

  const existingSprint = await db.board.findFirst({
    where: { title: "Sprint Board", groupId: acme.id },
  });
  if (existingSprint) await deleteBoardCascade(existingSprint.id);

  const existingRoadmap = await db.board.findFirst({
    where: { title: "Product Roadmap", groupId: acme.id },
  });
  if (existingRoadmap) await deleteBoardCascade(existingRoadmap.id);

  const sprintBoard = await db.board.create({
    data: {
      title: "Sprint Board",
      groupId: acme.id,
      members: { create: { userId: alice.id } },
      columns: {
        create: [
          { title: "To Do", position: 0 },
          { title: "In Progress", position: 1 },
          { title: "Done", position: 2 },
        ],
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  await db.board.create({
    data: {
      title: "Product Roadmap",
      groupId: acme.id,
      columns: {
        create: [
          { title: "To Do", position: 0 },
          { title: "In Progress", position: 1 },
          { title: "Done", position: 2 },
        ],
      },
    },
  });

  const [todo, inProgress, done] = sprintBoard.columns;
  if (!todo || !inProgress || !done) {
    throw new Error("Expected three default columns");
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  const tasks = await db.task.createMany({
    data: [
      {
        title: "Set up project repo",
        columnId: todo.id,
        position: 0,
        priority: "HIGH",
        deadline: futureDeadline,
      },
      {
        title: "Design board layout",
        columnId: todo.id,
        position: 1,
        priority: "MEDIUM",
        assigneeId: alice.id,
        deadline: pastDeadline,
      },
      {
        title: "Write API docs",
        columnId: todo.id,
        position: 2,
        priority: "LOW",
        deadline: pastDeadline,
      },
      {
        title: "Implement auth flow",
        columnId: inProgress.id,
        position: 0,
        priority: "CRITICAL",
        assigneeId: alice.id,
        columnEnteredAt: oneDayAgo,
        deadline: futureDeadline,
      },
      {
        title: "Add task pagination",
        columnId: inProgress.id,
        position: 1,
        priority: "HIGH",
        columnEnteredAt: twoDaysAgo,
      },
      {
        title: "Deploy to Railway",
        columnId: done.id,
        position: 0,
        priority: "HIGH",
        assigneeId: alice.id,
        columnEnteredAt: twoDaysAgo,
      },
    ],
  });

  console.log("Seed complete:");
  console.log(`  Users: ${ALICE_EMAIL}, ${BOB_EMAIL} (password: ${DEMO_PASSWORD})`);
  console.log(`  Groups: Acme Corp (${ACME_CODE}), Beta Labs (${BETA_CODE})`);
  console.log(`  Alice: MANAGER in Acme Corp with access to Sprint Board`);
  console.log(`  Bob: not in a group — use join code to demo`);
  console.log(`  Product Roadmap: visible to Acme members but locked until access granted`);
  console.log(`  Tasks created: ${tasks.count}`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
