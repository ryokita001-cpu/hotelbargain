import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron からの呼び出しであることを確認する。
 * CRON_SECRET が未設定の場合はローカル開発用として素通しする。
 */
export function assertCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
