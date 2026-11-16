import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Planner",
  description: "Intelligent influencer campaign planning — brief, build and present in three steps.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies the saved theme/language before paint to avoid a flash.
const boot = `try{var s=JSON.parse(localStorage.getItem('marketing-planner-v1')||'{}').state||{};var st=s.settings||{};var t=st.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(st.language==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: boot }} /></head>
      <body>{children}</body>
    </html>
  );
}
