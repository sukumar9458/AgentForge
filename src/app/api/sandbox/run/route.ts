import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { executeBlock } from "@/lib/sandbox/executor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request payload
    const { code, language, provider, timeoutMs } = await req.json();

    if (code === undefined || !language) {
      return NextResponse.json(
        { error: "Missing required fields: 'code' and 'language' are required" },
        { status: 400 }
      );
    }

    // 3. Execute the code block with requested or auto provider
    const result = await executeBlock(code, language, {
      provider: provider || "auto",
      timeoutMs: typeof timeoutMs === "number" ? timeoutMs : undefined,
    });

    // 4. Return execution details
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Sandbox run route error:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during sandbox execution" },
      { status: 500 }
    );
  }
}
