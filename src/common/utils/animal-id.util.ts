export async function generateUniqueAnimalSid(prisma: any): Promise<string> {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const allChars = lowercase + uppercase + digits;

  let sid: string = '';
  let exists = true;

  while (exists) {
    const chars = [];
    // Ensure at least one of each character types (lower, upper, digit)
    chars.push(lowercase[Math.floor(Math.random() * lowercase.length)]);
    chars.push(uppercase[Math.floor(Math.random() * uppercase.length)]);
    chars.push(digits[Math.floor(Math.random() * digits.length)]);

    // Fill the remaining 7 characters to reach length of 10
    for (let i = 0; i < 7; i++) {
      chars.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    // Fisher-Yates shuffle for true randomness
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    sid = chars.join('');
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
