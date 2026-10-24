import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ThemeProvider } from "@/components/theme";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "envman",
  description: "Encrypted environment variable manager",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full", geist.variable, geistMono.variable)}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <ConfirmProvider>{children}</ConfirmProvider>
            <Toaster position="bottom-right" richColors closeButton duration={2500} />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
