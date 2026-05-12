import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/context/CartContext";
import { CompanyProvider } from "@/context/CompanyContext";
import { ThemeProvider } from "@/context/ThemeContext";
import CartDrawer from "@/components/CartDrawer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3aed",
};

export const metadata: Metadata = {
  title: {
    default: "FASTSTORE | Tu Tienda Online",
    template: "%s | FASTSTORE"
  },
  description: "Descubre la mejor selección de productos con la mejor calidad y servicio. Envío rápido y pagos seguros.",
  keywords: ["ecommerce", "tienda online", "productos", "FASTSTORE", "compras online"],
  authors: [{ name: "FASTSTORE" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    title: "FASTSTORE | Tu Tienda Online",
    description: "La mejor experiencia de compra online. Calidad, rapidez y seguridad en cada pedido.",
    siteName: "FASTSTORE",
    images: [{ url: "/icon-512x512.png", width: 512, height: 512, alt: "FASTSTORE Logo" }],
  },
  twitter: {
    card: "summary",
    title: "FASTSTORE | Tu Tienda Online",
    description: "La mejor experiencia de compra online.",
    images: ["/icon-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen selection:bg-primary/30`}
      >
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white opacity-40"></div>
        <CompanyProvider>
          <ThemeProvider>
            <CartProvider>
              <CartDrawer />
              {children}
            </CartProvider>
          </ThemeProvider>
        </CompanyProvider>
      </body>
    </html>
  );
}
