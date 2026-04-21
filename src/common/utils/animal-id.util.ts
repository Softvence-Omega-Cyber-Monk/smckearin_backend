export async function generateUniqueAnimalSid(prisma: any): Promise<string> {
  let sid: string = '';
  let exists = true;
  while (exists) {
    sid = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await checkAnimalSidExists(prisma, sid);
  }
  return sid;
}

export async function checkAnimalSidExists(
  prisma: any,
  sid: string,
): Promise<boolean> {
  const animal = await prisma.animal.findUnique({
    where: { sid },
    select: { id: true },
  });
  return !!animal;
}
