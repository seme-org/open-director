import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { createSession, hashPassword } from "@/server/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash: hashPassword(body.password),
    },
  });
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
