"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    MessageSquare,
    Package,
    Settings2,
    Code2
} from "lucide-react"

export function MobileNav() {
    const pathname = usePathname()

    const navItems = [
        {
            label: "生成",
            icon: MessageSquare,
            href: "/",
            isActive: pathname === "/"
        },
        {
            label: "资产",
            icon: Package,
            href: "/assets",
            isActive: pathname === "/assets"
        },
        {
            label: "API",
            icon: Code2,
            href: "/api-docs",
            isActive: pathname === "/api-docs"
        },
        {
            label: "设置",
            icon: Settings2,
            href: "/settings",
            isActive: pathname === "/settings"
        }
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border lg:hidden safe-area-bottom">
            <div className="flex items-center justify-around h-16 px-4">
                {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className="flex-1">
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center py-2 rounded-xl transition-all duration-200 gap-1",
                                item.isActive
                                    ? "text-primary"
                                    : "text-muted-foreground"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", item.isActive && "text-primary")} strokeWidth={item.isActive ? 2.5 : 2} />
                            <span className={cn("text-[11px] font-medium", item.isActive ? "text-primary" : "")}>
                                {item.label}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </nav>
    )
}