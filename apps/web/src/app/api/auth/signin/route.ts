import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { createSession, verifyPassword } from "@/server/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
