import { type NextRequest, NextResponse } from "next/server"

interface Changelog {
  id: string
  version: string
  content: string
  createdAt: string
  updatedAt: string
}

// In-memory storage (in production, use a database)
const changelogs: Changelog[] = [
  {
    id: "1",
    version: "v1.2.0",
    content: "• Better Stability\n• Improved UNC to 35\n• Fixed bugs\n• Fully New Ui (UNFINISHED)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    version: "v1.0.1",
    content: "• 25 UNC\n• Minor bug fixes\n• Optimized Bridge",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    version: "v1.0.0",
    content: "• Release\n• UI\n• 18 UNC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const token = authHeader.substring(7)
  // Simple token validation (in production, use proper JWT validation)
  return token === Buffer.from("A3fj281").toString("base64")
}

export async function GET() {
  return NextResponse.json({ changelogs })
}

export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { version, content } = await request.json()

    if (!version || !content) {
      return NextResponse.json({ error: "Version and content are required" }, { status: 400 })
    }

    const newChangelog: Changelog = {
      id: Date.now().toString(),
      version,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    changelogs.unshift(newChangelog)

    return NextResponse.json({ changelog: newChangelog }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id, version, content } = await request.json()

    if (!id || !version || !content) {
      return NextResponse.json({ error: "ID, version and content are required" }, { status: 400 })
    }

    const changelogIndex = changelogs.findIndex((c) => c.id === id)
    if (changelogIndex === -1) {
      return NextResponse.json({ error: "Changelog not found" }, { status: 404 })
    }

    changelogs[changelogIndex] = {
      ...changelogs[changelogIndex],
      version,
      content,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ changelog: changelogs[changelogIndex] })
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const changelogIndex = changelogs.findIndex((c) => c.id === id)
    if (changelogIndex === -1) {
      return NextResponse.json({ error: "Changelog not found" }, { status: 404 })
    }

    changelogs.splice(changelogIndex, 1)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
