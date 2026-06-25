// app/map/[id]/layout.tsx - Добавляем CSS для Leaflet
import 'leaflet/dist/leaflet.css';

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}