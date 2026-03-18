import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const renames: [string, string][] = [
  ['Main Gymnasium', 'MCB Gym'],
  ['Auxiliary Gym', 'Field House'],
  ['Chaparral Stadium', 'Tom Landry Stadium'],
  ['Baseball Complex', 'Trojan Baseball Field'],
  ['Track & Field Complex', 'Trojan Blue Track'],
  ['Tennis Center', 'Trojan Tennis Courts'],
];

async function main() {
  for (const [oldName, newName] of renames) {
    const result = await prisma.facility.updateMany({
      where: { name: oldName },
      data: { name: newName },
    });
    console.log(`${oldName} → ${newName}: ${result.count} updated`);
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
