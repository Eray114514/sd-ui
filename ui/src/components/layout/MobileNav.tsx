"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"
import {
    MessageSquare,
    Package,
    Settings2,
    Code2,
    Menu,
    X,
    Palette
} from "lucide-react"

export function MobileNav() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)

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
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border lg:hidden pt-[env(safe-area-inset-top)]">
                <div className="flex items-center justify-between h-14 px-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/20">
                            <Palette className="w-[18px] h-[18px] text-white" />
                        </div>
                        <span className="font-bold text-sm tracking-tight text-foreground">SD-UI</span>
                    </Link>

                    {/* Right section: Avatar & Hamburger */}
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                            U
                        </div>
                        <button 
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isOpen ? <X className="w-[22px] h-[22px]" /> : <Menu className="w-[22px] h-[22px]" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <div 
                className={cn(
                    "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-all duration-300 pt-[calc(3.5rem+env(safe-area-inset-top))]",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
            >
                <div 
                    className={cn(
                        "flex flex-col gap-2 p-4 transition-transform duration-300 ease-out",
                        isOpen ? "translate-y-0" : "-translate-y-4"
                    )}
                >
                    {navItems.map((item) => (
                        <Link 
                            key={item.href} 
                            href={item.href} 
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-95",
                                item.isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "bg-card text-muted-foreground border border-border/50 hover:bg-accent/50 hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("w-[22px] h-[22px]", item.isActive && "text-primary")} strokeWidth={item.isActive ? 2.5 : 2} />
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    )
}