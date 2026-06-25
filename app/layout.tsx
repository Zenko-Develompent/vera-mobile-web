// app/layout.tsx - Корневой layout
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Система маршрутизации СМП - Оренбургская область',
  description: 'Автоматизированная система для фельдшеров скорой помощи',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}