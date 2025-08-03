// apps/frontend/app/layout.tsx (수정 후)
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers"; // Providers는 그대로 유지합니다.

const inter = Inter({ subsets: ["latin"] });

// 서버 컴포넌트이므로 Metadata를 다시 사용할 수 있습니다.
export const metadata: Metadata = {
  title: "My Awesome Blog",
  description: "Built with Next.js and AWS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {/* Providers는 Amplify 설정을 담당하므로 그대로 둡니다. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}