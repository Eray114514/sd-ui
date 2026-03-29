import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Private AI Image Generator",
  description: "WebUI Forge Client",
  icons: {
    icon: "/palette.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="flex min-h-screen bg-background text-foreground pl-sidebar">
            <Sidebar />
            <div className="flex-1 w-full transition-all duration-300">
              {children}
            </div>
          </div>
          <MobileNav />
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
