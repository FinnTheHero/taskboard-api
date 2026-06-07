import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const DEMO_PASSWORD = "demo1234";
const ALICE_EMAIL = "alice@demo.com";
const BOB_EMAIL = "bob@demo.com";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

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

  const existingBoard = await db.board.findFirst({
    where: { title: "Sprint Board", ownerId: alice.id },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  if (existingBoard) {
    await db.notification.deleteMany({
      where: { task: { column: { boardId: existingBoard.id } } },
    });
    await db.comment.deleteMany({
      where: { task: { column: { boardId: existingBoard.id } } },
    });
    await db.task.deleteMany({
      where: { column: { boardId: existingBoard.id } },
    });
    await db.board.delete({ where: { id: existingBoard.id } });
  }

  const board = await db.board.create({
    data: {
      title: "Sprint Board",
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: "OWNER" },
          { userId: bob.id, role: "MEMBER" },
        ],
      },
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

  const [todo, inProgress, done] = board.columns;
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
        assigneeId: bob.id,
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
        assigneeId: bob.id,
        columnEnteredAt: twoDaysAgo,
      },
      {
        title: "Wire up notifications",
        columnId: inProgress.id,
        position: 2,
        priority: "MEDIUM",
        assigneeId: bob.id,
        columnEnteredAt: oneDayAgo,
      },
      {
        title: "Deploy to Railway",
        columnId: done.id,
        position: 0,
        priority: "HIGH",
        assigneeId: alice.id,
        columnEnteredAt: twoDaysAgo,
      },
      {
        title: "Create demo seed data",
        columnId: done.id,
        position: 1,
        priority: "MEDIUM",
        assigneeId: bob.id,
        columnEnteredAt: oneDayAgo,
      },
      {
        title: "Prepare presentation",
        columnId: todo.id,
        position: 3,
        priority: "CRITICAL",
        assigneeId: alice.id,
      },
      {
        title: "Review pull requests",
        columnId: inProgress.id,
        position: 3,
        priority: "LOW",
        assigneeId: alice.id,
        columnEnteredAt: twoDaysAgo,
      },
    ],
  });

  const assignedTask = await db.task.findFirst({
    where: { columnId: inProgress.id, assigneeId: bob.id },
  });

  if (assignedTask) {
    await db.comment.create({
      data: {
        body: "Making good progress on this one!",
        taskId: assignedTask.id,
        authorId: alice.id,
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  Users: ${ALICE_EMAIL}, ${BOB_EMAIL} (password: ${DEMO_PASSWORD})`);
  console.log(`  Board: "${board.title}" (${board.id})`);
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
