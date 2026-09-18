import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "Free",
      slug: "free",
      description: "Get started with basic scheduling for a single account.",
      priceMonthly: 0,
      priceYearly: 0,
      currency: "USD",
      maxSocialAccounts: 1,
      maxPostsPerMonth: 10,
      maxTeamMembers: 1,
      maxWorkspaces: 1,
      aiAccess: false,
      advancedAnalytics: false,
      approvalWorkflow: false,
      whiteLabel: false,
      isFree: true,
      sortOrder: 0,
    },
    {
      name: "Starter",
      slug: "starter",
      description: "For growing creators and small teams.",
      priceMonthly: 29,
      priceYearly: 290,
      currency: "USD",
      maxSocialAccounts: 5,
      maxPostsPerMonth: 100,
      maxTeamMembers: 3,
      maxWorkspaces: 1,
      aiAccess: true,
      advancedAnalytics: true,
      approvalWorkflow: false,
      whiteLabel: false,
      isFree: false,
      sortOrder: 1,
    },
    {
      name: "Business",
      slug: "business",
      description: "For businesses managing multiple channels with a team.",
      priceMonthly: 79,
      priceYearly: 790,
      currency: "USD",
      maxSocialAccounts: 15,
      maxPostsPerMonth: 1000,
      maxTeamMembers: 10,
      maxWorkspaces: 1,
      aiAccess: true,
      advancedAnalytics: true,
      approvalWorkflow: true,
      whiteLabel: false,
      isFree: false,
      sortOrder: 2,
    },
    {
      name: "Agency",
      slug: "agency",
      description: "For agencies managing many clients with white-label options.",
      priceMonthly: 199,
      priceYearly: 1990,
      currency: "USD",
      maxSocialAccounts: 100,
      maxPostsPerMonth: 10000,
      maxTeamMembers: 50,
      maxWorkspaces: 10,
      aiAccess: true,
      advancedAnalytics: true,
      approvalWorkflow: true,
      whiteLabel: true,
      isFree: false,
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findUnique({
      where: { slug: plan.slug },
    });
    if (!existing) {
      await prisma.plan.create({ data: plan });
      console.log(`Seeded plan: ${plan.name}`);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });