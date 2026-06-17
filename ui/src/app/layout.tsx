import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "SD-UI",
  description: "Private Image Generator",
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
    <html lang="zh-CN" suppressHydrationWarning>
      <head />
      <body className={cn(geistSans.variable, geistMono.variable, "font-sans antialiased")}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="flex min-h-screen bg-background text-foreground pl-sidebar">
            <Sidebar />
            <div className="flex-1 w-full">
              {children}
            </div>
          </div>
          <MobileNav />
          <Toaster position="top-center" />
        </ThemeProvider>
        <Script id="chunk-error-handler" strategy="beforeInteractive">
          {`
            window.addEventListener('error', function(event) {
              if (event.message && (event.message.includes('Loading chunk') || event.message.includes('ChunkLoadError'))) {
                console.warn('ChunkLoadError detected, reloading page...');
                window.location.reload();
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}
