import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ФСП Карьера — навыки говорят за вас",
  description:
    "Подтверждённые компетенции, достижения спортивного программирования и осмысленные предложения о работе.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
