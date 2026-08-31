const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantUser = await prisma.user.findUnique({
    where: { email: 'golroger07roger@gmail.com' },
    include: {
      tenant: {
        include: {
          invoices: true
        }
      }
    }
  });
  
  console.log("Tenant:", JSON.stringify(tenantUser, null, 2));

  const adminUser = await prisma.user.findUnique({
    where: { email: 'srmall@admin.com' }
  });
  
  console.log("Admin:", adminUser);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
