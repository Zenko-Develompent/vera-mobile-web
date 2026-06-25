// app/map/[id]/page.tsx - Полный файл с таймером поездки
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import { CENTERS_MAP, getCenterByName, calculateDistance, completeCall } from "@/app/data";

// Динамический импорт компонентов Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false },
);
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false },
);

import "leaflet/dist/leaflet.css";

// API для построения маршрута через OSRM
const OSRM_API = "https://router.project-osrm.org/route/v1/driving";

interface RouteData {
  geometry: string;
  distance: number;
  duration: number;
  points: [number, number][];
}

// Получение маршрута через OSRM API
async function fetchRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): Promise<RouteData | null> {
  try {
    const url = `${OSRM_API}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error("No route found");
    }

    const route = data.routes[0];
    const geometry = route.geometry;
    const distance = route.distance / 1000;
    const duration = route.duration / 60;

    const points: [number, number][] = geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]],
    );

    return {
      geometry: JSON.stringify(geometry),
      distance,
      duration,
      points,
    };
  } catch (error) {
    console.error("Error fetching route:", error);
    return null;
  }
}

// Генерация маршрута-заглушки
function generateFallbackRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  segments: number = 30,
): [number, number][] {
  const points: [number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const curveOffset = Math.sin(t * Math.PI * 2) * 0.002;
    const lat = start.lat + (end.lat - start.lat) * t + curveOffset * 0.5;
    const lng = start.lng + (end.lng - start.lng) * t + curveOffset;
    points.push([lat, lng]);
  }

  return points;
}

// Вычисление направления движения (азимут)
function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// Поиск ближайшей точки на маршруте
function findClosestPointOnRoute(
  routePoints: [number, number][],
  location: { lat: number; lng: number },
): { index: number; point: [number, number] } | null {
  if (routePoints.length === 0) return null;

  let minDist = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < routePoints.length; i++) {
    const dist = calculateDistance(
      location.lat,
      location.lng,
      routePoints[i][0],
      routePoints[i][1],
    );
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  return {
    index: closestIndex,
    point: routePoints[closestIndex],
  };
}

export default function MapPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const callId = params.id as string;
  const destinationName =
    searchParams.get("dest") ||
    "ГАУЗ «Оренбургская областная клиническая больница им. В.И. Войнова»";

  const [isClient, setIsClient] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [destinationPos, setDestinationPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [travelTime, setTravelTime] = useState<number>(0);
  const [isInRadius, setIsInRadius] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeReason, setCompleteReason] = useState("");
  const [showOperatorHelp, setShowOperatorHelp] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driveMode, setDriveMode] = useState<"view" | "drive">("drive");
  const [userHeading, setUserHeading] = useState<number>(0);
  const [previousLocation, setPreviousLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const mapRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const isFirstLoad = useRef(true);
  const animationFrameRef = useRef<number | null>(null);

  // Состояние для модалки завершения с причиной
  const [showCompleteWithReason, setShowCompleteWithReason] = useState(false);
  const [completionReason, setCompletionReason] = useState("");

  // Состояние для чата
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: string; text: string; time: string }>
  >([
    {
      sender: "Оператор",
      text: "Добрый день! Чем могу помочь?",
      time: "12:30",
    },
  ]);
  const [newMessage, setNewMessage] = useState("");

  // Состояние для таймера поездки
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Фикс иконок Leaflet
  useEffect(() => {
    if (typeof window !== "undefined") {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
      setIsClient(true);
    }
  }, []);

  // Загрузка сохраненного времени при монтировании
  useEffect(() => {
    if (typeof window !== "undefined" && callId) {
      const savedTime = localStorage.getItem(`trip_start_${callId}`);
      if (savedTime) {
        const parsedTime = parseInt(savedTime, 10);
        setTripStartTime(parsedTime);
        const elapsed = Math.floor((Date.now() - parsedTime) / 1000);
        setElapsedTime(elapsed);
      } else {
        const now = Date.now();
        setTripStartTime(now);
        localStorage.setItem(`trip_start_${callId}`, String(now));
        setElapsedTime(0);
      }
    }
  }, [callId]);

  // Запуск таймера
  useEffect(() => {
    if (tripStartTime === null) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - (tripStartTime || Date.now())) / 1000,
      );
      setElapsedTime(elapsed);
      localStorage.setItem(`trip_start_${callId}`, String(tripStartTime));
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [tripStartTime, callId]);

  // Функция форматирования времени
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Получение реальных координат устройства
  useEffect(() => {
    if (!isClient) return;

    const destination = getCenterByName(destinationName);
    if (destination) {
      setDestinationPos({ lat: destination.lat, lng: destination.lng });
    }

    if (!navigator.geolocation) {
      setError("Геолокация не поддерживается вашим браузером");
      setUserLocation({ lat: 51.7715, lng: 55.0837 });
      setPreviousLocation({ lat: 51.7715, lng: 55.0837 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setPreviousLocation({ lat: latitude, lng: longitude });
        setError(null);
      },
      (err) => {
        console.error("Ошибка геолокации:", err);
        setError(
          "Не удалось определить местоположение. Используются тестовые координаты.",
        );
        setUserLocation({ lat: 51.7715, lng: 55.0837 });
        setPreviousLocation({ lat: 51.7715, lng: 55.0837 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };

        if (heading !== null && heading !== undefined) {
          setUserHeading(heading);
        } else if (previousLocation) {
          const bearing = calculateBearing(
            previousLocation.lat,
            previousLocation.lng,
            latitude,
            longitude,
          );
          setUserHeading(bearing);
        }

        setUserLocation(newLocation);
        setPreviousLocation(newLocation);
        setError(null);
      },
      (err) => {
        console.error("Ошибка отслеживания:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      },
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isClient, destinationName]);

  // Построение маршрута при изменении позиции
  useEffect(() => {
    if (!userLocation || !destinationPos) return;

    const buildRoute = async () => {
      setIsLoadingRoute(true);
      setRouteError(null);

      try {
        const route = await fetchRoute(userLocation, destinationPos);

        if (route && route.points.length > 0) {
          setRoutePoints(route.points);
          setDistance(Math.round(route.distance * 10) / 10);
          setTravelTime(Math.round(route.duration));
        } else {
          const fallbackPoints = generateFallbackRoute(
            userLocation,
            destinationPos,
          );
          setRoutePoints(fallbackPoints);

          const dist = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            destinationPos.lat,
            destinationPos.lng,
          );
          setDistance(Math.round(dist * 10) / 10);
          setTravelTime(Math.round((dist / 40) * 60));

          setRouteError("Используется приблизительный маршрут");
        }

        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          destinationPos.lat,
          destinationPos.lng,
        );
        setIsInRadius(dist < 0.5);
      } catch (error) {
        console.error("Error building route:", error);
        setRouteError("Ошибка построения маршрута");
      } finally {
        setIsLoadingRoute(false);
      }
    };

    buildRoute();
  }, [userLocation, destinationPos]);

  // Анимация карты в режиме поездки
  useEffect(() => {
    if (!mapInstance || !userLocation || !driveMode || !isFollowing) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const updateMap = () => {
      if (!mapInstance || !userLocation) return;

      const zoom = 17;

      mapInstance.setView([userLocation.lat, userLocation.lng], zoom, {
        animate: true,
        duration: 0.3,
      });

      if (userHeading !== null && userHeading !== undefined) {
        if (typeof mapInstance.setBearing === "function") {
          mapInstance.setBearing(-userHeading, {
            animate: true,
            duration: 0.3,
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateMap);
    };

    animationFrameRef.current = requestAnimationFrame(updateMap);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mapInstance, userLocation, driveMode, isFollowing, userHeading]);

  const centerMapOnUser = useCallback(() => {
    if (mapInstance && userLocation) {
      setIsFollowing(true);
      if (driveMode) {
        mapInstance.flyTo([userLocation.lat, userLocation.lng], 17, {
          duration: 1,
        });
      } else {
        mapInstance.flyTo([userLocation.lat, userLocation.lng], 15, {
          duration: 1.5,
        });
      }
    }
  }, [mapInstance, userLocation, driveMode]);

  const fitRoute = useCallback(() => {
    if (mapInstance && routePoints.length > 0) {
      const bounds = L.latLngBounds(routePoints);
      mapInstance.flyToBounds(bounds, {
        padding: [50, 50],
        duration: 1.5,
      });
      setIsFollowing(false);
    }
  }, [mapInstance, routePoints]);

  const toggleDriveMode = useCallback(() => {
    const newMode = driveMode === "view" ? "drive" : "view";
    setDriveMode(newMode);

    if (newMode === "drive" && userLocation && mapInstance) {
      setIsFollowing(true);
      mapInstance.flyTo([userLocation.lat, userLocation.lng], 17, {
        duration: 1,
      });
      if (userHeading && typeof mapInstance.setBearing === "function") {
        mapInstance.setBearing(-userHeading);
      }
    } else {
      fitRoute();
    }
  }, [driveMode, mapInstance, userLocation, userHeading, fitRoute]);

  const handleMapMove = useCallback(() => {
    if (driveMode) {
      setIsFollowing(false);
    }
  }, [driveMode]);

  // Обновленная функция завершения вызова
  const handleComplete = () => {
    if (isInRadius) {
      finishCall("completed", "Прибытие на место");
    } else {
      setCompletionReason("");
      setShowCompleteWithReason(true);
    }
  };

  // Подтверждение завершения с причиной
  const confirmCompleteWithReason = () => {
    if (!completionReason.trim()) {
      alert("Пожалуйста, укажите причину завершения вызова");
      return;
    }
    completeCall(callId, completionReason)
    setShowCompleteWithReason(false);
    finishCall("completed", completionReason);
  };

  // Обновленная функция завершения вызова (очищает таймер)
  const finishCall = (status: "completed" | "canceled", reason: string) => {
    // Очищаем таймер
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    // Удаляем сохраненное время
    localStorage.removeItem(`trip_start_${callId}`);

    const calls = JSON.parse(localStorage.getItem("calls") || "[]");
    const updatedCalls = calls.map((c: any) =>
      c.id === callId
        ? { ...c, status, reason, tripDuration: elapsedTime }
        : c,
    );
    localStorage.setItem("calls", JSON.stringify(updatedCalls));
    router.push("/calls");
  };

  // Функция для отправки сообщения в чат
  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const now = new Date();
    const time =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    setChatMessages((prev) => [
      ...prev,
      { sender: "Я", text: newMessage, time },
    ]);
    setNewMessage("");

    setTimeout(
      () => {
        const responses = [
          "Принял информацию. Работаем.",
          "Понял, ожидайте дальнейших указаний.",
          "Информация передана диспетчеру.",
          "Будьте на связи, скоро ответим.",
        ];
        const randomResponse =
          responses[Math.floor(Math.random() * responses.length)];
        const now2 = new Date();
        const time2 =
          now2.getHours().toString().padStart(2, "0") +
          ":" +
          now2.getMinutes().toString().padStart(2, "0");
        setChatMessages((prev) => [
          ...prev,
          { sender: "Оператор", text: randomResponse, time: time2 },
        ]);
      },
      1000 + Math.random() * 1000,
    );
  };

  const handleOperatorApprove = () => {
    setShowOperatorHelp(false);
    finishCall("canceled", "Отменено оператором: " + completeReason);
  };

  const centerInfo = getCenterByName(destinationName);

  if (!isClient || !userLocation || !destinationPos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Определение местоположения...</p>
          <p className="text-sm text-gray-400 mt-2">
            Разрешите доступ к геолокации
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Верхняя панель */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-[1000]">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/calls")}
              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-800 truncate">
                Маршрут к центру
              </h1>
              <p className="text-sm text-gray-500 truncate">
                Пациент: Петров И.С.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isLoadingRoute && (
              <span className="text-xs text-blue-600">
                Построение маршрута...
              </span>
            )}
            {/* Отображение таймера */}
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-mono font-medium text-gray-700">
                {formatTime(elapsedTime)}
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                isInRadius
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {isInRadius
                ? "В радиусе доставки"
                : `${distance} км / ${travelTime} мин`}
            </span>
          </div>
        </div>
      </header>

      {/* Основной контент с картой */}
      <div className="flex-1 relative min-h-0">
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 z-[1001]">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}

        {routeError && (
          <div className="absolute top-4 left-4 right-4 bg-blue-50 border border-blue-200 rounded-xl p-3 z-[1001]">
            <p className="text-sm text-blue-800">{routeError}</p>
          </div>
        )}

        <div className="w-full h-full">
          <MapContainer
            key={`map-${userLocation.lat}-${userLocation.lng}`}
            center={[userLocation.lat, userLocation.lng]}
            zoom={driveMode ? 17 : 15}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
            whenReady={() => {
              const map = mapRef.current;
              if (map) {
                setMapInstance(map);
                map.on("moveend", handleMapMove);
                if (typeof map.setBearing === "function") {
                  map.setBearing(0);
                }
              }
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Зона доставки */}
            {destinationPos && (
              <Circle
                center={[destinationPos.lat, destinationPos.lng]}
                radius={250}
                pathOptions={{
                  color: "#22c55e",
                  fillColor: "#4ade80",
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: "5, 5",
                }}
              />
            )}

            {/* Маршрут */}
            {routePoints.length > 0 && (
              <>
                <Polyline
                  positions={routePoints}
                  pathOptions={{
                    color: "#3B82F6",
                    weight: 10,
                    opacity: 0.9,
                    lineJoin: "round",
                  }}
                />
              </>
            )}

            {/* Маркер назначения */}
            {destinationPos && (
              <Marker
                position={[destinationPos.lat, destinationPos.lng]}
                icon={L.divIcon({
                  className: "custom-marker",
                  html: `<div style="background-color: #EF4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                    <svg style="width: 22px; height: 22px; fill: white;" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <div style="position: absolute; bottom: -8px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #EF4444;"></div>
                  </div>`,
                  iconSize: [40, 48],
                  iconAnchor: [20, 48],
                })}
              >
                <Popup>
                  <div className="font-medium text-base">{destinationName}</div>
                  <div className="text-sm text-gray-600">
                    {centerInfo?.address}
                  </div>
                  <div className="text-xs text-blue-600 mt-1 font-medium">
                    {centerInfo?.typeLabel}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Маркер пользователя */}
            {userLocation && (
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={L.divIcon({
                  className: "custom-marker",
                  html: `<div style="background-color: #3B82F6; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); position: relative; background: radial-gradient(circle at 35% 35%, #60A5FA, #3B82F6);">
                    <div style="width: 20px; height: 20px; background: white; border-radius: 50%; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);"></div>
                    <div style="position: absolute; width: 80px; height: 80px; border-radius: 50%; border: 2px solid rgba(59, 130, 246, 0.3); animation: pulse-ring 2s ease-out infinite;"></div>
                  </div>`,
                  iconSize: [50, 50],
                  iconAnchor: [25, 25],
                })}
              ></Marker>
            )}
          </MapContainer>
        </div>

        {/* Окно чата */}
        {showChat && (
          <div className="absolute bottom-28 left-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[1000] flex flex-col max-h-[600px] min-h-[320px]">
            <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-blue-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-gray-800">Оператор</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-3 overflow-y-auto max-h-[250px] space-y-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "Я" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`px-3 py-2 rounded-xl max-w-[85%] ${
                      msg.sender === "Я"
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                  <span className="text-xs text-gray-400 mt-0.5">
                    {msg.time}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-gray-200 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Введите сообщение..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
              >
                Отправить
              </button>
            </div>
          </div>
        )}

        {/* Нижняя панель */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl border border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:w-auto min-w-0">
                <p className="text-xs text-gray-500">Пункт назначения</p>
                <p className="font-medium text-gray-800 text-sm truncate">
                  {destinationName}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {centerInfo?.address}
                </p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-center flex-shrink-0">
                  <p className="text-xs text-gray-500">В пути</p>
                  <p className="font-bold text-gray-800 font-mono">
                    {formatTime(elapsedTime)}
                  </p>
                </div>
                <div className="text-center flex-shrink-0">
                  <p className="text-xs text-gray-500">Расстояние</p>
                  <p className="font-bold text-gray-800">{distance} км</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className={`p-3 rounded-xl transition flex items-center justify-center ${
                      showChat
                        ? "bg-blue-500 text-white border-blue-500 border-1"
                        : "border-1 border-blue-500 text-blue-500 hover:bg-blue-50"
                    }`}
                    title="Чат с оператором"
                  >
                    <svg
                      className={`w-6 h-6 ${showChat ? "fill-white" : "fill-blue-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleComplete}
                    className={`px-5 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                      isInRadius
                        ? "bg-blue-500 hover:bg-blue-700 text-white"
                        : "border-blue-500 border-1 hover:bg-blue-50 text-blue-500"
                    }`}
                  >
                    Завершить вызов
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модалка завершения с причиной */}
      {showCompleteWithReason && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Внимание!</h3>
                <p className="text-sm text-gray-600">
                  Вы находитесь вне радиуса доставки. Укажите причину завершения
                  поездки:
                </p>
              </div>
            </div>

            <textarea
              value={completionReason}
              onChange={(e) => setCompletionReason(e.target.value)}
              placeholder="Например: пациент передумал, вызов ложный, другая причина..."
              className="w-full text-black px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none text-sm"
              autoFocus
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCompleteWithReason(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={confirmCompleteWithReason}
                disabled={!completionReason.trim()}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                  completionReason.trim()
                    ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно оператора */}
      {showOperatorHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[2000]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-8 h-8 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mt-2">
                Запрос оператору
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Причина: {completeReason || "Не указана"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p>Оператор рассмотрит возможность завершения вызова.</p>
              <p className="mt-1 text-xs text-gray-400">
                Время ожидания: ~30 секунд
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowOperatorHelp(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleOperatorApprove}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition shadow-md"
              >
                Одобрить завершение
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          height: 100% !important;
          width: 100% !important;
          z-index: 1 !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .leaflet-popup-tip {
          background: white;
        }
        .leaflet-control-zoom {
          display: none !important;
        }
        .leaflet-control-attribution {
          font-size: 8px !important;
          opacity: 0.5 !important;
        }
      `}</style>
    </div>
  );
}