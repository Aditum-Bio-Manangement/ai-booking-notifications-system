"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { AlertCircle, Lock, Mail, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login, loginWithMicrosoft, isSupabaseConfigured } = useAuth()
  const router = useRouter()
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await login(email, password)
      if (result.success) {
        router.push("/")
      } else {
        setError(result.error || "Login failed")
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Aditum%20Logo%20Horizontal%201536x1024-5t69K1LQrBFk3K8lGSV6y6nHkWuYrG.png"
            alt="Aditum Bio"
            width={280}
            height={80}
            className="mb-2"
            style={{ width: 'auto', height: 'auto' }}
            priority
          />
          <p className="text-sm text-muted-foreground">Room Booking Notifications</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Administrator Login</CardTitle>
            <CardDescription>
              Sign in to manage room booking notifications and settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel>Email Address</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="admin@aditumbio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
              </FieldGroup>

              <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              {isSupabaseConfigured && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={isMicrosoftLoading}
                    onClick={async () => {
                      setIsMicrosoftLoading(true)
                      setError("")
                      try {
                        const result = await loginWithMicrosoft()
                        if (!result.success) {
                          setError(result.error || "Microsoft login failed")
                        }
                      } catch {
                        setError("Failed to initiate Microsoft login")
                      } finally {
                        setIsMicrosoftLoading(false)
                      }
                    }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                    {isMicrosoftLoading ? "Redirecting..." : "Sign in with Microsoft"}
                  </Button>
                </>
              )}
            </form>

            <div className="mt-6 rounded-lg border border-muted bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Demo Credentials</p>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Admin:</span>{" "}
                  admin@aditumbio.com / admin123
                </p>
                <p>
                  <span className="font-medium text-foreground">Operator:</span>{" "}
                  operator@aditumbio.com / operator123
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This system is for authorized personnel only. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  )
}
