import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: "Groceries", icon: "shopping-cart", color: "#22c55e" },
  { name: "Rent & Housing", icon: "home", color: "#6366f1" },
  { name: "Utilities", icon: "plug", color: "#eab308" },
  { name: "Transport", icon: "car", color: "#0ea5e9" },
  { name: "Dining & Restaurants", icon: "utensils", color: "#f97316" },
  { name: "Entertainment", icon: "clapperboard", color: "#a855f7" },
  { name: "Health & Fitness", icon: "heart-pulse", color: "#ef4444" },
  { name: "Shopping", icon: "shopping-bag", color: "#ec4899" },
  { name: "Subscriptions", icon: "repeat", color: "#14b8a6" },
  { name: "Travel", icon: "plane", color: "#3b82f6" },
  { name: "Income", icon: "banknote", color: "#16a34a" },
  { name: "Transfers", icon: "arrow-left-right", color: "#64748b" },
  { name: "Fees & Charges", icon: "receipt", color: "#dc2626" },
  { name: "Other", icon: "more-horizontal", color: "#94a3b8" },
];

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@financialtracker.app" },
    update: {},
    create: {
      email: "demo@financialtracker.app",
      name: "Demo User",
      emailVerified: true,
    },
  });

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: demoUser.id, name: cat.name } },
      update: {},
      create: { ...cat, userId: demoUser.id, isSystem: true },
    });
  }

  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories for ${demoUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
