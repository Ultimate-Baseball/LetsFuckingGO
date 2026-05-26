import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const APP_URL = "https://ultimatebaseballtool.com";
const APP_NAME = "Ultimate Baseball Tool";
const APP_DESC = "Real-time health and effectiveness ratings for all 30 MLB team bullpens. Track pitcher workload, fatigue, WHIP grades, and IL status. Powered by Picks2click";

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_DESC,
  applicationName: APP_NAME,
  keywords: ["MLB", "bullpen", "baseball", "pitcher health", "bullpen tracker", "baseball analytics", "UltimateBaseballTool"],
  authors: [{ name: "UltimateBaseballTool.com", url: APP_URL }],
  creator: "UltimateBaseballTool.com",
  publisher: "UltimateBaseballTool.com",
  category: "sports",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-16x16.png",  sizes: "16x16",  type: "image/png" },
      { url: "/icons/icon-32x32.png",  sizes: "32x32",  type: "image/png" },
      { url: "/icons/icon-96x96.png",  sizes: "96x96",  type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/icons/icon-76x76.png",   sizes: "76x76",   type: "image/png" },
      { url: "/icons/icon-60x60.png",   sizes: "60x60",   type: "image/png" },
    ],
    other: [{ rel: "mask-icon", url: "/icons/icon-192x192.png" }],
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    title: APP_NAME,
    description: APP_DESC,
    siteName: APP_NAME,
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512, alt: APP_NAME }],
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESC,
    images: ["/icons/icon-512x512.png"],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1e3a5f" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen`}>

        {/*
          Splash overlay — server-rendered so React sees it in the DOM and doesn't
          report a hydration mismatch. suppressHydrationWarning on this element tells
          React to ignore attribute/style changes made by the inline script below.
          The script only changes styles (opacity/display), never adds or removes nodes.
        */}
        <div
          id="ubt-splash"
          suppressHydrationWarning
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.6s ease",
          }}
        >
          <video
            id="ubt-splash-video"
            src="/ubt-intro.mp4"
            autoPlay
            muted
            playsInline
            suppressHydrationWarning
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Register service worker for PWA / offline support
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                }

                // Only touches styles on the server-rendered div — never creates or
                // removes DOM nodes, so React hydration finds the element in place.
                function dismissSplash() {
                  var el = document.getElementById('ubt-splash');
                  if (!el) return;
                  el.style.opacity = '0';
                  el.style.transition = 'opacity 0.3s ease';
                  setTimeout(function() { el.style.display = 'none'; }, 350);
                }

                // Skip if triggered by the header Refresh button
                if (sessionStorage.getItem('ubt_skip_splash')) {
                  sessionStorage.removeItem('ubt_skip_splash');
                  dismissSplash();
                  return;
                }

                // Skip if the animation has already played this session
                if (sessionStorage.getItem('ubt_seen_splash')) {
                  dismissSplash();
                  return;
                }

                // First load — play the animation, then mark as seen
                sessionStorage.setItem('ubt_seen_splash', '1');

                var vid = document.getElementById('ubt-splash-video');
                if (vid) {
                  vid.addEventListener('ended', dismissSplash);
                  vid.addEventListener('error', function() { setTimeout(dismissSplash, 500); });
                  setTimeout(dismissSplash, 6000);
                } else {
                  setTimeout(dismissSplash, 5500);
                }
              })();
            `,
          }}
        />

        {children}
      </body>
    </html>
  );
}
