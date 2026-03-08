import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  const reportPath = path.join(process.cwd(), "public", "report.html")
  const html = fs.readFileSync(reportPath, "utf8")

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  })
}
