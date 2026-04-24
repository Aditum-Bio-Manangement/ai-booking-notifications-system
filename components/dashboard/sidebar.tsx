"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import {
  LayoutDashboard,
  DoorOpen,
  CalendarClock,
  Bell,
  Activity,
  Sparkles,
  FileText,
  HelpCircle,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isOpen?: boolean
  onClose?: () => void
}

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "bookings", label: "Bookings", icon: CalendarClock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "ai-insights", label: "AI Insights", icon: Sparkles },
]

const secondaryItems = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "docs", label: "Documentation", icon: FileText },
  { id: "help", label: "Help & Support", icon: HelpCircle },
]

export function DashboardSidebar({ activeTab, onTabChange, isOpen = false, onClose }: SidebarProps) {
  const handleTabChange = (tab: string) => {
    onTabChange(tab)
    // Close sidebar on mobile after selection
    onClose?.()
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-in-out md:static md:z-auto md:w-56 md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between border-b border-border p-4 md:hidden">
          <span className="font-semibold text-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Main
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
          <div className="mb-2 mt-6 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resources
          </div>
          {secondaryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-success" />
              System Healthy
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Last sync: 2 min ago
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
