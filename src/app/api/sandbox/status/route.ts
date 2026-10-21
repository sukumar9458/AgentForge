import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasE2BKey = Boolean(
      process.env.E2B_API_KEY && process.env.E2B_API_KEY.trim().length > 0
    );

    return NextResponse.json({
      cloudAvailable: hasE2BKey,
      activeProvider: hasE2BKey ? "e2b-cloud" : "local-sandbox",
      providerName: hasE2BKey ? "E2B Cloud MicroVM" : "Local Isolated Sandbox",
      supportedLanguages: [
        "javascript",
        "typescript",
        "python",
        "bash",
        "html",
        "react/tsx",
        "svg",
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve sandbox status" },
      { status: 500 }
    );
  }
}
