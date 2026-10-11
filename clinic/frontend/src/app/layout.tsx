import type { Metadata } from "next";
import { Providers } from "@/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "clinic",
  description:
    "Healthcare clinic management platform for admins, doctors, and patients.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
