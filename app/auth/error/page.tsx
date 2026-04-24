"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case "auth_callback_error":
        return "There was an error during the authentication callback. Please try signing in again."
      case "access_denied":
        return "Access was denied. You may not have permission to access this application."
      case "invalid_request":
        return "The authentication request was invalid. Please try again."
      default:
        return "An unexpected authentication error occurred. Please try signing in again."
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle>Authentication Error</CardTitle>
        <CardDescription>{getErrorMessage(error)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button asChild className="w-full">
          <Link href="/login">Return to Login</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          If this problem persists, please contact your administrator.
        </p>
      </CardContent>
    </Card>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      }>
        <AuthErrorContent />
      </Suspense>
    </div>
  )
}
