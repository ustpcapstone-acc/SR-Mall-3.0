import type { Metadata } from "next";
import { Inter, Source_Serif_4, Geist_Mono } from "next/font/google";
import { AuthProvider } from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Typography: Inter for all interface text (formal, highly legible);
// Source Serif 4 for display headings on public pages (`font-display`).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SR Mall | Shops, dining and spaces in Jasaan",
  description:
    "SR Mall in Jasaan, Misamis Oriental: browse the shops and their products, see what's on, and rent a space.",
};

// Prevent iOS Safari auto-zoom on input focus while still allowing user pinch-to-zoom
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow user-initiated pinch zoom up to 5x
  userScalable: true, // Never disable user zoom
  interactiveWidget: "resizes-content",
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* isolate: Kumo pop-ups portal to <body> and need their own stacking context. */}
      <body className="min-h-full flex flex-col isolate">
        <ThemeProvider
          // "class" drives the app's dark: styles; "data-mode" drives Kumo components.
          attribute={["class", "data-mode"]}
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
