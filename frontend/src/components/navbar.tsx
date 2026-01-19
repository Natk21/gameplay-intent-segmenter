"use client"

import Link from "next/link"
import type { MouseEvent } from "react"
import { usePathname } from "next/navigation"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  const pathname = usePathname()

  const handleHowItWorksClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") return

    event.preventDefault()
    const target = document.getElementById("how-it-works")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
      window.history.replaceState(null, "", "#how-it-works")
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
        <Link href="/" className="mr-8 font-semibold">
          Intent Segmenter
        </Link>

        <div className="ml-auto flex items-center gap-6">
          <NavigationMenu>
            <NavigationMenuList className="gap-6">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                <Link href="/#how-it-works" onClick={handleHowItWorksClick}>
                  How it works
                </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <Button
            asChild
            className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
          >
            <Link href="/app">Get started</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
