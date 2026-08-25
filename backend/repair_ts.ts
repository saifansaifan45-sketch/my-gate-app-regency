import { prisma } from './src/prisma';

async function repair() {
  const allPersonnel = await prisma.personnel.findMany({
    include: { user: true }
  });
  
  let repaired = 0;
  for (const personnel of allPersonnel) {
    if (personnel.category === 'MAINTENANCE' && personnel.userId) {
      if (personnel.name.toLowerCase().includes('watchman') || personnel.name.toLowerCase().includes('security') || personnel.user?.email.includes('watchman') || personnel.user?.email.includes('security') || personnel.user?.firstName?.toLowerCase() === 'watchman') {
        console.log('Repairing MAINTENANCE -> SECURITY for:', personnel.name, personnel.user?.email);
        await prisma.personnel.update({
          where: { id: personnel.id },
          data: { category: 'SECURITY', department: 'SECURITY' }
        });
        
        await prisma.auditLog.create({
          data: {
             communityId: personnel.communityId || '',
             actorId: personnel.userId,
             action: 'WORKFORCE_APPROVED' as any,
             metadata: { personnelId: personnel.id, previousCategory: 'MAINTENANCE', newCategory: 'SECURITY', note: 'Data repair' }
          }
        }).catch(() => {});
        repaired++;
      }
    }
  }
  console.log(`Repaired ${repaired} accounts.`);
}
repair().catch(console.error).finally(() => prisma.$disconnect());
