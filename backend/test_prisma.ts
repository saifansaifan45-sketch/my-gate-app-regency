import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  await prisma.visitor.update({
    where: { id: '123', status: 'PENDING' },
    data: { status: 'APPROVED' }
  });
}
