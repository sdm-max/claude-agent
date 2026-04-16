import os from "os";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const home = os.homedir();
  return NextResponse.json({
    homePath: home,
    claudeDir: path.join(home, ".claude"),
  });
}
