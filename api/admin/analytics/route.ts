import { type NextRequest, NextResponse } from "next/server"

interface AnalyticsData {
  totalDownloads: number
  pageViews: number
  uniqueVisitors: number
  lastUpdated: string
  dailyStats: Array<{
    date: string
    downloads: number
    pageViews: number
    visitors: number
  }>
}

// In-memory storage (in production, use a database)
const analyticsData: AnalyticsData = {
  totalDownloads: 0,
  pageViews: 0,
  uniqueVisitors: 0,
  lastUpdated: new Date().toISOString(),
  dailyStats: [],
}

// Track unique visitors using IP addresses (in production, use proper user tracking)
const uniqueVisitors = new Set<string>()

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  return forwarded?.split(",")[0] || realIP || "unknown"
}

function updateDailyStats(type: "download" | "pageView" | "visitor") {
  const today = new Date().toISOString().split("T")[0]
  let todayStats = analyticsData.dailyStats.find((stat) => stat.date === today)

  if (!todayStats) {
    todayStats = { date: today, downloads: 0, pageViews: 0, visitors: 0 }
    analyticsData.dailyStats.push(todayStats)
  }

  switch (type) {
    case "download":
      todayStats.downloads++
      break
    case "pageView":
      todayStats.pageViews++
      break
    case "visitor":
      todayStats.visitors++
      break
  }

  // Keep only last 30 days
  analyticsData.dailyStats = analyticsData.dailyStats
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      analytics: analyticsData,
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch analytics" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { event, data } = await request.json()
    const clientIP = getClientIP(request)

    switch (event) {
      case "download":
        analyticsData.totalDownloads++
        updateDailyStats("download")
        console.log("[v0] Download tracked:", analyticsData.totalDownloads)
        break

      case "pageView":
        analyticsData.pageViews++
        updateDailyStats("pageView")

        // Track unique visitors
        if (!uniqueVisitors.has(clientIP)) {
          uniqueVisitors.add(clientIP)
          analyticsData.uniqueVisitors++
          updateDailyStats("visitor")
        }
        console.log("[v0] Page view tracked:", analyticsData.pageViews)
        break

      default:
        return NextResponse.json({ success: false, error: "Invalid event type" }, { status: 400 })
    }

    analyticsData.lastUpdated = new Date().toISOString()

    return NextResponse.json({
      success: true,
      analytics: analyticsData,
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to track analytics" }, { status: 500 })
  }
}
