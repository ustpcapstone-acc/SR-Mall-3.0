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

  if (!tenantUser || !tenantUser.tenant || tenantUser.tenant.invoices.length === 0) {
    console.log("No tenant or invoices found.");
    return;
  }

  // Set the first invoice due date to tomorrow (1 day diff)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const updatedInvoice = await prisma.invoice.update({
    where: { id: tenantUser.tenant.invoices[0].id },
    data: { dueDate: tomorrow }
  });

  console.log("Updated invoice due date to tomorrow:", updatedInvoice.dueDate);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
