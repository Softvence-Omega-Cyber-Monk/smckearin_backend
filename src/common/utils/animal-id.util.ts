import { PrismaClient } from '@prisma';

export async function generateUniqueAnimalSid(prisma: any): Promise<string> {
  let sid: string = '';
  let exists = true;
  while (exists) {
    sid = Math.floor(100000 + Math.random() * 900000).toString();
    const animal = await prisma.animal.findUnique({
      where: { sid },
      select: { id: true },
    });
    if (!animal) exists = false;
  }
  return sid;
}
