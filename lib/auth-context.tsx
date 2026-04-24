"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser, Session } from "@supabase/supabase-js"

export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "operator" | "viewer"
  avatarUrl?: string
  department?: string
  title?: string
  phone?: string
  createdAt: string
  lastLogin: string
}

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isSupabaseConfigured: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithMicrosoft: () => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_STORAGE_KEY = "auth-user"
const USERS_STORAGE_KEY = "auth-users"

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Default admin users for demo mode (when Supabase is not configured)
const defaultUsers = [
  {
    id: "1",
    email: "admin@aditumbio.com",
    password: "admin123",
    name: "Admin User",
    role: "admin" as const,
    department: "IT",
    title: "System Administrator",
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  },
  {
    id: "2",
    email: "operator@aditumbio.com",
    password: "operator123",
    name: "Room Operator",
    role: "operator" as const,
    department: "Facilities",
    title: "Facilities Coordinator",
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  
  const supabaseConfigured = isSupabaseConfigured()

  // Initialize demo users in localStorage if not using Supabase
  useEffect(() => {
    if (!supabaseConfigured) {
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY)
      if (!storedUsers) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers))
      }
    }
  }, [supabaseConfigured])

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (supabaseConfigured) {
          // Use Supabase auth
          const supabase = createClient()
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          
          if (currentSession?.user) {
            setSession(currentSession)
            setSupabaseUser(currentSession.user)
            
            // Get profile from database
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", currentSession.user.id)
              .single()
            
            if (profile) {
              // Use profile name, or user metadata name, or extract from email
              const displayName = profile.name || 
                currentSession.user.user_metadata?.name || 
                currentSession.user.user_metadata?.full_name ||
                currentSession.user.email?.split("@")[0] || 
                "User"
              
              setUser({
                id: profile.id,
                email: profile.email || currentSession.user.email || "",
                name: displayName,
                role: profile.role || "viewer",
                avatarUrl: profile.avatar_url,
                department: profile.department,
                title: profile.title,
                phone: profile.phone,
                createdAt: profile.created_at,
                lastLogin: profile.last_login || new Date().toISOString(),
              })
            } else {
              // Create basic user from Supabase user
              const displayName = currentSession.user.user_metadata?.name || 
                currentSession.user.user_metadata?.full_name ||
                currentSession.user.email?.split("@")[0] || 
                "User"
              
              setUser({
                id: currentSession.user.id,
                email: currentSession.user.email || "",
                name: displayName,
                role: "viewer",
                createdAt: currentSession.user.created_at,
                lastLogin: new Date().toISOString(),
              })
            }
          }
          
          // Listen for auth changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
              setSession(newSession)
              setSupabaseUser(newSession?.user || null)
              
              if (event === "SIGNED_OUT") {
                setUser(null)
              } else if (newSession?.user) {
                // Fetch profile on sign in
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", newSession.user.id)
                  .single()
                
                if (profile) {
                  setUser({
                    id: profile.id,
                    email: profile.email || newSession.user.email || "",
                    name: profile.name || newSession.user.user_metadata?.name || "User",
                    role: profile.role || "viewer",
                    avatarUrl: profile.avatar_url,
                    department: profile.department,
                    title: profile.title,
                    phone: profile.phone,
                    createdAt: profile.created_at,
                    lastLogin: profile.last_login || new Date().toISOString(),
                  })
                }
              }
            }
          )
          
          return () => {
            subscription.unsubscribe()
          }
        } else {
          // Demo mode - use localStorage
          const stored = localStorage.getItem(AUTH_STORAGE_KEY)
          if (stored) {
            const parsedUser = JSON.parse(stored)
            setUser(parsedUser)
          }
        }
      } catch (e) {
        console.error("Failed to restore auth session:", e)
        if (!supabaseConfigured) {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [supabaseConfigured])

  // Redirect to login if not authenticated (except for login page)
  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login" && pathname !== "/auth/callback") {
      router.push("/login")
    }
  }, [isLoading, user, pathname, router])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (supabaseConfigured) {
        const supabase = createClient()
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          return { success: false, error: error.message }
        }

        if (data.user) {
          // Update last login
          await supabase
            .from("profiles")
            .update({ last_login: new Date().toISOString() })
            .eq("id", data.user.id)
        }

        return { success: true }
      } else {
        // Demo mode - use localStorage
        await new Promise((resolve) => setTimeout(resolve, 500))

        const storedUsers = localStorage.getItem(USERS_STORAGE_KEY)
        const users = storedUsers ? JSON.parse(storedUsers) : defaultUsers

        const matchedUser = users.find(
          (u: typeof defaultUsers[0]) =>
            u.email.toLowerCase() === email.toLowerCase() && u.password === password
        )

        if (!matchedUser) {
          return { success: false, error: "Invalid email or password" }
        }

        const { password: _, ...userWithoutPassword } = matchedUser
        const sessionUser: User = {
          ...userWithoutPassword,
          lastLogin: new Date().toISOString(),
        }

        const updatedUsers = users.map((u: typeof defaultUsers[0]) =>
          u.id === matchedUser.id ? { ...u, lastLogin: new Date().toISOString() } : u
        )
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers))
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser))
        setUser(sessionUser)

        return { success: true }
      }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, error: "An error occurred during login" }
    }
  }

  const loginWithMicrosoft = async (): Promise<{ success: boolean; error?: string }> => {
    if (!supabaseConfigured) {
      return { success: false, error: "SSO requires Supabase to be configured" }
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid profile email",
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Microsoft login error:", error)
      return { success: false, error: "Failed to initiate Microsoft login" }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!supabaseConfigured) {
      return { success: false, error: "Sign up requires Supabase to be configured" }
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Sign up error:", error)
      return { success: false, error: "Failed to sign up" }
    }
  }

  const logout = async () => {
    if (supabaseConfigured) {
      const supabase = createClient()
      await supabase.auth.signOut()
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
    setUser(null)
    setSupabaseUser(null)
    setSession(null)
    router.push("/login")
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return

    if (supabaseConfigured) {
      const supabase = createClient()
      await supabase
        .from("profiles")
        .update({
          name: updates.name,
          avatar_url: updates.avatarUrl,
          department: updates.department,
          title: updates.title,
          phone: updates.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    } else {
      // Update in localStorage
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY)
      if (storedUsers) {
        const users = JSON.parse(storedUsers)
        const updatedUsers = users.map((u: typeof defaultUsers[0]) =>
          u.id === user.id ? { ...u, ...updates } : u
        )
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers))
      }
    }

    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)

    if (!supabaseConfigured) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser))
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isLoading,
        isAuthenticated: !!user,
        isSupabaseConfigured: supabaseConfigured,
        login,
        loginWithMicrosoft,
        logout,
        updateProfile,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
