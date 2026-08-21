import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const CATEGORIES = [
  'Community events',
  'Crime & Safety',
  'Culture',
  'Discounts & Benefits',
  'Emergencies',
  'For Seniors',
  'Health',
  'Kids & Family',
  'City',
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to seed a production database');
  }

  const prisma = new PrismaClient();

  try {
    const categories = await Promise.all(
      CATEGORIES.map((name) =>
        prisma.category.upsert({
          where: { slug: slugify(name) },
          update: {},
          create: { name, slug: slugify(name) },
        }),
      ),
    );

    console.log(`seeded ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`);

    const existingAnnouncements = await prisma.announcement.count();

    if (existingAnnouncements === 0) {
      const cityCategory = categories.find((category) => category.slug === 'city');
      const communityCategory = categories.find(
        (category) => category.slug === 'community-events',
      );

      if (!cityCategory || !communityCategory) {
        throw new Error('seed categories are missing — run the category seed first');
      }

      await prisma.announcement.create({
        data: {
          title: 'Welcome to the city announcements board',
          content: 'This is a sample announcement seeded for local development.',
          publishedAt: new Date(),
          categories: {
            create: [{ categoryId: cityCategory.id }, { categoryId: communityCategory.id }],
          },
        },
      });

      console.log('seeded 1 sample announcement');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('seed failed', error);
  process.exit(1);
});
