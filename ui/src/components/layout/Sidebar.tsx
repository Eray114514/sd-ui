"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    Bell,
    MessageSquare,
    Package,
    Palette
} from "lucide-react"
import { SettingsDialog } from "@/components/custom/SettingsDialog"

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
        <aside className="fixed left-0 top-0 z-50 h-screen w-[80px] flex flex-col items-center bg-card border-r border-border py-6 transition-all hidden lg:flex">
            {/* Logo */}
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/20 mb-2 cursor-pointer hover:scale-105 transition-transform duration-200">
                <Palette className="w-[22px] h-[22px] text-white" />
            </div>

            <nav className="flex-1 flex flex-col gap-4 mt-6 w-full px-3">
                {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className="w-full">
                        <div
                            className={cn(
                                "w-full flex flex-col items-center justify-center py-3 rounded-2xl transition-all duration-200 gap-1.5 cursor-pointer",
                                item.isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", item.isActive && "text-primary")} strokeWidth={item.isActive ? 2.5 : 2} />
                            <span className={cn("text-[11px] font-medium", item.isActive ? "text-primary" : "")}>
                                {item.label}
                            </span>
                        </div>
                    </Link>
                ))}
            </nav>

            <div className="flex flex-col items-center gap-6 pb-2 w-full">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                    U
                </div>

                {/* API */}
                <div className="text-[11px] font-bold text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                    API
                </div>

                {/* Bell */}
                <div className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Bell className="w-[22px] h-[22px]" />
                </div>

                {/* Settings / Menu */}
                <SettingsDialog />
            </div>
        </aside>
    )
}
