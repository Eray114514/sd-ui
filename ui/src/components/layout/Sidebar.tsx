"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    MessageSquare,
    Package,
    Palette,
    Settings2,
    Code2
} from "lucide-react"

export function Sidebar() {
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
        }
    ]

    return (
        <aside className="fixed left-0 top-0 z-50 h-screen w-[80px] flex flex-col items-center bg-background border-r border-border py-6 transition-all hidden lg:flex">
            <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity duration-150">
                <Palette className="w-5 h-5" />
            </Link>

            <nav className="flex-1 flex flex-col gap-2 mt-8 w-full px-3">
                {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className="w-full">
                        <div
                            className={cn(
                                "w-full flex flex-col items-center justify-center py-3 rounded-xl transition-colors duration-150 gap-1.5 cursor-pointer",
                                item.isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", item.isActive && "text-primary")} strokeWidth={item.isActive ? 2.5 : 2} />
                            <span className={cn("text-[11px] font-medium", item.isActive ? "text-primary" : "")}>
                                {item.label}
                            </span>
                        </div>
                    </Link>
                ))}
            </nav>

            <div className="flex flex-col items-center gap-4 pb-2 w-full">
                <Link href="/api-docs">
                    <div className={cn(
                        "flex flex-col items-center justify-center py-2.5 rounded-xl transition-colors cursor-pointer gap-1",
                        pathname === "/api-docs" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}>
                        <Code2 className="w-5 h-5" />
                        <span className="text-[10px] font-medium">API</span>
                    </div>
                </Link>

                <Link href="/settings">
                    <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-xl transition-colors cursor-pointer",
                        pathname === "/settings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )} title="系统设置">
                        <Settings2 className="w-5 h-5" />
                    </div>
                </Link>
            </div>
        </aside>
    )
}
