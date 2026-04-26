import { NextResponse } from "next/server";
import { getSupportEmail } from "@/lib/support";

export async function GET() {
  return NextResponse.json({ supportEmail: getSupportEmail() });
}
