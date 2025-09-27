import { type NextRequest, NextResponse } from "next/server"

interface AppSettings {
  downloadUrl: string
  maintenanceMode: boolean
  announcementText: string
  showAnnouncement: boolean
  updatedAt: string
}

// In-memory storage (in production, use a database)
let settings: AppSettings = {
  downloadUrl: "https://gofile.io/d/qtUQtv",
  maintenanceMode: false,
  announcementText: "",
  showAnnouncement: false,
  updatedAt: new Date().toISOString(),
}

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const token = authHeader.substring(7)
  return token === Buffer.from("A3fj281").toString("base64")
}

export async function GET() {
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const updates = await request.json()

    settings = {
      ...settings,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}
