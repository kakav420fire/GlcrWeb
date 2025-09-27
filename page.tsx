"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface Changelog {
  id: string
  version: string
  content: string
  createdAt: string
  updatedAt: string
}

interface AppSettings {
  downloadUrl: string
  maintenanceMode: boolean
  announcementText: string
  showAnnouncement: boolean
  updatedAt: string
}

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

const SECURITY_CONFIG = {
  key: "QTNmajI4MQ==", // This is just base64("A3fj281")
  salt: "glacier_2025_secure",
  iterations: 1000,
}

function decryptKey(encoded: string): string {
  try {
    return atob(encoded)
  } catch {
    return ""
  }
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export default function GlacierApp() {
  const [currentPage, setCurrentPage] = useState("home")
  const [showAdminOverlay, setShowAdminOverlay] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState("")

  // Server-side data
  const [changelogs, setChangelogs] = useState<Changelog[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    downloadUrl: "https://gofile.io/d/qtUQtv",
    maintenanceMode: false,
    announcementText: "",
    showAnnouncement: false,
    updatedAt: new Date().toISOString(),
  })

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalDownloads: 0,
    pageViews: 0,
    uniqueVisitors: 0,
    lastUpdated: new Date().toISOString(),
    dailyStats: [],
  })

  // Admin form states
  const [newVersion, setNewVersion] = useState("")
  const [newContent, setNewContent] = useState("")
  const [editingChangelog, setEditingChangelog] = useState<Changelog | null>(null)
  const [loading, setLoading] = useState(false)

  const trackEvent = useCallback(async (event: string, data?: any) => {
    try {
      await fetch("/api/admin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, data }),
      })
    } catch (error) {
      console.error("Failed to track event:", error)
    }
  }, [])

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/analytics")
      if (response.ok) {
        const { analytics: serverAnalytics } = await response.json()
        setAnalytics(serverAnalytics)
      }
    } catch (error) {
      console.error("Failed to load analytics:", error)
    }
  }, [])

  const loadServerData = useCallback(async () => {
    try {
      // Load changelogs
      const changelogResponse = await fetch("/api/admin/changelogs")
      if (changelogResponse.ok) {
        const { changelogs: serverChangelogs } = await changelogResponse.json()
        setChangelogs(serverChangelogs)
      }

      // Load settings
      const settingsResponse = await fetch("/api/admin/settings")
      if (settingsResponse.ok) {
        const { settings: serverSettings } = await settingsResponse.json()
        setSettings(serverSettings)
      }

      await loadAnalytics()
    } catch (error) {
      console.error("Failed to load server data:", error)
    }
  }, [loadAnalytics])

  useEffect(() => {
    loadServerData()
    trackEvent("pageView")
  }, [loadServerData, trackEvent])

  useEffect(() => {
    if (currentPage !== "home") {
      trackEvent("pageView")
    }
  }, [currentPage, trackEvent])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "KeyQ") {
        e.preventDefault()
        if (!showAdminOverlay) {
          setShowAdminOverlay(true)
          setTimeout(() => {
            const input = document.getElementById("admin-password") as HTMLInputElement
            input?.focus()
          }, 100)
        }
      }
      if (e.code === "Escape") {
        closeAdmin()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showAdminOverlay])

  const handleAdminAuth = async () => {
    if (!adminPassword.trim()) {
      showError("Please enter an access code")
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 500))

    const validCode = decryptKey(SECURITY_CONFIG.key)
    const isValid = secureCompare(adminPassword.trim(), validCode)

    if (isValid) {
      const token = Buffer.from("A3fj281").toString("base64")
      setAuthToken(token)
      setShowAdminPanel(true)
      setIsAuthenticated(true)
      setAdminPassword("")
      setErrorMessage("")
      await loadAnalytics()
    } else {
      showError("Invalid access code")
      setAdminPassword("")
      const input = document.getElementById("admin-password") as HTMLInputElement
      if (input) {
        input.disabled = true
        setTimeout(() => {
          input.disabled = false
        }, 2000)
      }
    }
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setTimeout(() => setErrorMessage(""), 3000)
  }

  const closeAdmin = () => {
    setShowAdminOverlay(false)
    setShowAdminPanel(false)
    setAdminPassword("")
    setErrorMessage("")
    setIsAuthenticated(false)
    setAuthToken("")
    setEditingChangelog(null)
    setNewVersion("")
    setNewContent("")
  }

  const apiCall = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        ...options.headers,
      },
    })
  }

  const addChangelog = async () => {
    if (!newVersion.trim() || !newContent.trim()) {
      showError("Please fill in both version and content")
      return
    }

    setLoading(true)
    try {
      const response = await apiCall("/api/admin/changelogs", {
        method: "POST",
        body: JSON.stringify({
          version: newVersion.trim(),
          content: newContent.trim(),
        }),
      })

      if (response.ok) {
        await loadServerData()
        setNewVersion("")
        setNewContent("")
      } else {
        showError("Failed to add changelog")
      }
    } catch (error) {
      showError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const updateChangelog = async () => {
    if (!editingChangelog || !editingChangelog.version.trim() || !editingChangelog.content.trim()) {
      showError("Please fill in both version and content")
      return
    }

    setLoading(true)
    try {
      const response = await apiCall("/api/admin/changelogs", {
        method: "PUT",
        body: JSON.stringify({
          id: editingChangelog.id,
          version: editingChangelog.version.trim(),
          content: editingChangelog.content.trim(),
        }),
      })

      if (response.ok) {
        await loadServerData()
        setEditingChangelog(null)
      } else {
        showError("Failed to update changelog")
      }
    } catch (error) {
      showError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const deleteChangelog = async (id: string) => {
    if (!confirm("Are you sure you want to delete this changelog?")) return

    setLoading(true)
    try {
      const response = await apiCall(`/api/admin/changelogs?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await loadServerData()
      } else {
        showError("Failed to delete changelog")
      }
    } catch (error) {
      showError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    setLoading(true)
    try {
      const response = await apiCall("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(newSettings),
      })

      if (response.ok) {
        await loadServerData()
      } else {
        showError("Failed to update settings")
      }
    } catch (error) {
      showError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async () => {
    if (settings.downloadUrl && settings.downloadUrl !== "https://example.com/download/glacier-latest.zip") {
      // Track download event
      await trackEvent("download")
      window.open(settings.downloadUrl, "_blank")
    } else {
      alert("Download link not configured. Please contact administrator.")
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://cdn.discordapp.com/attachments/1411267411201490957/1421485989896917182/2251490.png?ex=68d9357d&is=68d7e3fd&hm=fcaaf25736a2d67f89d95f51b1993cb348eb89b820c22ee6535e9be596596144&')",
        }}
      />

      {/* Dark Overlay */}
      <div className="fixed inset-0 bg-black/40 pointer-events-none" />

      {settings.maintenanceMode && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-40">
          🚧 Maintenance Mode Active - Some features may be unavailable
        </div>
      )}

      {settings.showAnnouncement && settings.announcementText && (
        <div
          className="fixed top-0 left-0 right-0 bg-blue-600 text-white text-center py-2 z-40"
          style={{ top: settings.maintenanceMode ? "40px" : "0" }}
        >
          📢 {settings.announcementText}
        </div>
      )}

      {/* Floating Particles */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/60 rounded-full animate-pulse"
            style={{
              left: `${10 + i * 10}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: "8s",
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div
        className="relative z-10"
        style={{
          paddingTop:
            settings.maintenanceMode || (settings.showAnnouncement && settings.announcementText) ? "40px" : "0",
        }}
      >
        {currentPage === "home" && (
          <div className="min-h-screen flex flex-col items-center justify-center text-center px-8">
            <h1 className="text-6xl md:text-8xl font-bold mb-4 text-shadow-lg">Glacier</h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-12 max-w-2xl leading-relaxed">
              We do what you need and want, quickly and simply.
            </p>

            <div className="flex gap-6 flex-wrap justify-center">
              <Button
                onClick={() => setCurrentPage("download")}
                className="bg-white/90 hover:bg-white text-black font-semibold px-8 py-4 text-lg rounded-xl shadow-2xl transition-all duration-300 hover:scale-105"
                disabled={settings.maintenanceMode}
              >
                Download
              </Button>
              <Button
                onClick={() => window.open("https://discord.gg/glacierstudios", "_blank")}
                className="bg-blue-600/90 hover:bg-blue-600 text-white font-semibold px-8 py-4 text-lg rounded-xl shadow-2xl transition-all duration-300 hover:scale-105"
              >
                Discord
              </Button>
            </div>

            {/* Features Section */}
            <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
              {[
                { icon: "❄️", title: "Crystal Clear", desc: "Experience unparalleled clarity in every interaction." },
                { icon: "⚡", title: "Lightning Fast", desc: "Speed that matches the pace of your ambitions." },
                { icon: "🎯", title: "Precision Focus", desc: "Every feature crafted with surgical precision." },
              ].map((feature, i) => (
                <Card
                  key={i}
                  className="bg-white/10 border-white/20 backdrop-blur-md hover:bg-white/15 transition-all duration-300"
                >
                  <CardHeader>
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentPage === "download" && (
          <div className="min-h-screen py-16 px-8">
            <Button
              onClick={() => setCurrentPage("home")}
              className="fixed top-8 left-8 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
            >
              ← Back
            </Button>

            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl font-bold mb-8">Download Glacier</h1>
              <p className="text-xl text-gray-200 mb-12">Get the latest version with all the newest features</p>

              {settings.maintenanceMode ? (
                <div className="w-96 h-56 mx-auto mb-8 bg-red-500/20 border border-red-500/40 rounded-2xl backdrop-blur-md flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4">🚧</div>
                  <span className="text-lg text-red-300">Download temporarily unavailable</span>
                </div>
              ) : (
                <div
                  className="w-96 h-56 mx-auto mb-8 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md cursor-pointer hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center"
                  onClick={downloadFile}
                >
                  <div className="text-6xl mb-4">📦</div>
                  <span className="text-lg">Click to Download</span>
                </div>
              )}

              <Button
                onClick={downloadFile}
                className="bg-blue-600/90 hover:bg-blue-600 text-white font-semibold px-12 py-6 text-xl rounded-xl shadow-2xl mb-16"
                disabled={settings.maintenanceMode}
              >
                ⬇️ Download Now
              </Button>

              <div className="text-left">
                <h2 className="text-3xl font-bold mb-8 text-center">📝 Recent Changes</h2>
                <div className="space-y-4">
                  {changelogs.map((changelog, i) => (
                    <Card key={changelog.id} className="bg-white/10 border-white/20 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-blue-400">{changelog.version}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-gray-300 whitespace-pre-line">{changelog.content}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          Updated: {new Date(changelog.updatedAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAdminOverlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          {!showAdminPanel ? (
            <Card className="bg-white/10 border-white/20 backdrop-blur-md w-96">
              <CardHeader>
                <CardTitle className="text-white text-center">🔐 Admin Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Enter access code"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminAuth()}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  maxLength={20}
                />
                {errorMessage && <p className="text-red-400 text-sm">{errorMessage}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleAdminAuth} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    Access
                  </Button>
                  <Button
                    onClick={closeAdmin}
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/10 border-white/20 backdrop-blur-md w-full max-w-6xl h-[90vh] overflow-y-auto">
              <CardHeader className="relative">
                <button
                  onClick={closeAdmin}
                  className="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
                <CardTitle className="text-white text-center text-2xl">🏔️ Glacier Admin Panel</CardTitle>
                <p className="text-gray-300 text-center">Server-side management system</p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="changelogs" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-white/10">
                    <TabsTrigger value="changelogs" className="text-white data-[state=active]:bg-white/20">
                      Changelogs
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="text-white data-[state=active]:bg-white/20">
                      Settings
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="text-white data-[state=active]:bg-white/20">
                      Analytics
                    </TabsTrigger>
                    <TabsTrigger value="system" className="text-white data-[state=active]:bg-white/20">
                      System
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="changelogs" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Add New Changelog */}
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">Add New Changelog</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Input
                            placeholder="Version (e.g., v1.3.0)"
                            value={newVersion}
                            onChange={(e) => setNewVersion(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                          />
                          <Textarea
                            placeholder="Changelog content..."
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 min-h-32"
                          />
                          <Button
                            onClick={addChangelog}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            {loading ? "Adding..." : "Add Changelog"}
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Edit Existing Changelog */}
                      {editingChangelog && (
                        <Card className="bg-white/5 border-white/10">
                          <CardHeader>
                            <CardTitle className="text-white">Edit Changelog</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Input
                              placeholder="Version"
                              value={editingChangelog.version}
                              onChange={(e) => setEditingChangelog({ ...editingChangelog, version: e.target.value })}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                            />
                            <Textarea
                              placeholder="Changelog content..."
                              value={editingChangelog.content}
                              onChange={(e) => setEditingChangelog({ ...editingChangelog, content: e.target.value })}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 min-h-32"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={updateChangelog}
                                disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                              >
                                {loading ? "Updating..." : "Update"}
                              </Button>
                              <Button
                                onClick={() => setEditingChangelog(null)}
                                variant="outline"
                                className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
                              >
                                Cancel
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Existing Changelogs */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-white">Existing Changelogs</h3>
                      {changelogs.map((changelog) => (
                        <Card key={changelog.id} className="bg-white/5 border-white/10">
                          <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-blue-400">{changelog.version}</CardTitle>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setEditingChangelog(changelog)}
                                className="bg-yellow-600 hover:bg-yellow-700"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => deleteChangelog(changelog.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="text-gray-300 whitespace-pre-line mb-2">{changelog.content}</div>
                            <div className="text-xs text-gray-500">
                              Created: {new Date(changelog.createdAt).toLocaleString()} | Updated:{" "}
                              {new Date(changelog.updatedAt).toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Download Settings */}
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">Download Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label className="text-white">Download URL</Label>
                            <Input
                              value={settings.downloadUrl}
                              onChange={(e) => updateSettings({ downloadUrl: e.target.value })}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                              placeholder="https://example.com/download"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* System Settings */}
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">System Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Maintenance Mode</Label>
                            <Switch
                              checked={settings.maintenanceMode}
                              onCheckedChange={(checked) => updateSettings({ maintenanceMode: checked })}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Announcement Settings */}
                      <Card className="bg-white/5 border-white/10 lg:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-white">Announcement Banner</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Show Announcement</Label>
                            <Switch
                              checked={settings.showAnnouncement}
                              onCheckedChange={(checked) => updateSettings({ showAnnouncement: checked })}
                            />
                          </div>
                          <div>
                            <Label className="text-white">Announcement Text</Label>
                            <Input
                              value={settings.announcementText}
                              onChange={(e) => updateSettings({ announcementText: e.target.value })}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                              placeholder="Enter announcement message..."
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-semibold text-white">Real-Time Analytics</h3>
                      <Button onClick={loadAnalytics} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Refresh
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">Total Downloads</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-green-400">
                            {analytics.totalDownloads.toLocaleString()}
                          </div>
                          <p className="text-gray-400">Tracked downloads</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">Page Views</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-blue-400">{analytics.pageViews.toLocaleString()}</div>
                          <p className="text-gray-400">Total page views</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">Unique Visitors</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-purple-400">
                            {analytics.uniqueVisitors.toLocaleString()}
                          </div>
                          <p className="text-gray-400">Unique visitors</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Daily Stats */}
                    {analytics.dailyStats.length > 0 && (
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <CardTitle className="text-white">Daily Statistics (Last 7 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analytics.dailyStats.slice(0, 7).map((stat) => (
                              <div
                                key={stat.date}
                                className="flex justify-between items-center p-3 bg-white/5 rounded-lg"
                              >
                                <span className="text-white font-medium">
                                  {new Date(stat.date).toLocaleDateString()}
                                </span>
                                <div className="flex gap-6 text-sm">
                                  <span className="text-green-400">📥 {stat.downloads} downloads</span>
                                  <span className="text-blue-400">👁️ {stat.pageViews} views</span>
                                  <span className="text-purple-400">👤 {stat.visitors} visitors</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white">Analytics Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-400">
                          <p>Last Updated: {new Date(analytics.lastUpdated).toLocaleString()}</p>
                          <p className="mt-2">Analytics are tracked in real-time and persist server-side.</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="system" className="space-y-6">
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white">System Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Server Status:</span>
                            <span className="text-green-400 ml-2">Online</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Last Updated:</span>
                            <span className="text-white ml-2">{new Date(settings.updatedAt).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Total Changelogs:</span>
                            <span className="text-white ml-2">{changelogs.length}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Admin Sessions:</span>
                            <span className="text-white ml-2">1 Active</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
