// app/calls/page.tsx - Обновленная страница с кнопкой обновления у поля адреса
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCalls,
  createCall,
  completeCall,
  cancelCall,
  Call,
  clearAllCalls,
  getActiveCalls,
} from "@/app/data/calls";
import { getCenterForDistrict, DISTRICT_MAPPINGS } from "@/app/data";
import { getRoutingDecision, CHECKLIST } from "@/app/data";
import { CENTERS_MAP } from "@/app/data";

// Функция для поиска адресов (автодополнение)
async function searchAddresses(
  query: string,
): Promise<Array<{ display_name: string; lat: string; lon: string }>> {
  if (query.length < 3) return [];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&accept-language=ru&limit=5&countrycodes=ru`,
      {
        headers: {
          "User-Agent": "SMP-Routing-System/1.0",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Ошибка поиска адресов");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Ошибка поиска адресов:", error);
    return [];
  }
}

// Функция для определения района из адреса (вынесем в отдельную функцию)
const extractDistrictFromAddress = (address: string): string | null => {
  if (!address || address.length < 2) return null;

  const lowerAddress = address.toLowerCase();

  // Ищем точное совпадение района в адресе
  const found = DISTRICT_MAPPINGS.find((m) =>
    lowerAddress.includes(m.district.toLowerCase()),
  );

  if (found) {
    return found.district;
  }

  // Если точного совпадения нет, ищем частичное
  for (const m of DISTRICT_MAPPINGS) {
    const districtLower = m.district.toLowerCase();
    // Разбиваем адрес на части и проверяем каждую
    const parts = lowerAddress.split(/[,.]/).map((p) => p.trim());
    for (const part of parts) {
      if (
        part.length > 2 &&
        (part.includes(districtLower) || districtLower.includes(part))
      ) {
        return m.district;
      }
    }
  }

  return null;
};

// Функция для получения адреса по координатам (обратное геокодирование)
async function getAddressFromCoords(
  lat: number,
  lng: number,
): Promise<{
  address: string;
  district: string;
  city: string;
}> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
      {
        headers: {
          "User-Agent": "SMP-Routing-System/1.0",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Ошибка геокодирования");
    }

    const data = await response.json();

    if (data && data.display_name) {
      const address = data.address || {};
      const districtFromApi =
        address.city_district ||
        address.suburb ||
        address.district ||
        address.city ||
        "";
      const city = address.city || address.town || address.village || "";

      const fullAddress = data.display_name;

      // Используем ту же логику для определения района
      let foundDistrict = districtFromApi;

      // Ищем совпадение с нашей базой районов
      const districts = DISTRICT_MAPPINGS.map((m) => m.district);
      const matchingDistrict = districts.find(
        (d) =>
          foundDistrict.includes(d) ||
          d.includes(foundDistrict) ||
          foundDistrict.toLowerCase().includes(d.toLowerCase()) ||
          d.toLowerCase().includes(foundDistrict.toLowerCase()),
      );

      if (matchingDistrict) {
        foundDistrict = matchingDistrict;
      } else {
        // Если не нашли, пробуем искать по частям адреса
        const extractedDistrict = extractDistrictFromAddress(fullAddress);
        if (extractedDistrict) {
          foundDistrict = extractedDistrict;
        } else {
          // Если ничего не нашли, используем город
          foundDistrict = city || "Ленинский район";
        }
      }

      return {
        address: fullAddress,
        district: foundDistrict,
        city: city,
      };
    }

    throw new Error("Не удалось определить адрес");
  } catch (error) {
    console.error("Ошибка получения адреса:", error);
    return {
      address: "Адрес не определен",
      district: "Ленинский район",
      city: "Оренбург",
    };
  }
}

// Функция для получения текущего местоположения
function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Геолокация не поддерживается"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showNewCall, setShowNewCall] = useState(false);
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Загрузка вызовов при монтировании
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/");
      return;
    }
    setUser(JSON.parse(userData));
    loadCalls();
  }, [router]);

  // Закрытие меню при клике вне него
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Функция загрузки вызовов
  const loadCalls = () => {
    const loadedCalls = getCalls();
    setCalls(loadedCalls);

    // Проверяем наличие активных вызовов
    const active = getActiveCalls();
    setHasActiveCall(active.length > 0);
  };

  const handleLogout = () => {
    clearAllCalls();
    localStorage.removeItem("user");
    router.push("/");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "canceled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Активный";
      case "completed":
        return "Завершён";
      case "canceled":
        return "Отменён";
      default:
        return status;
    }
  };

  // Обработчик нажатия на кнопку "Начать вызов"
  const handleNewCallClick = () => {
    const active = getActiveCalls();
    if (active.length > 0) {
      alert(
        `Невозможно начать новый вызов. У вас уже есть активный вызов #${active[0].id.slice(0, 8)} для пациента "${active[0].patientName}". Завершите или отмените его перед созданием нового.`,
      );
      return;
    }
    setShowNewCall(true);
  };

  // Получаем инициалы пользователя для аватарки
  const getUserInitials = () => {
    if (!user?.name) return "👤";
    const parts = user.name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name[0]?.toUpperCase() || "👤";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 lg:px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="./logo.png" alt="" className="size-8" />
            <h1 className="text-2xl font-medium text-[#33BBFF]">Вера</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Меню пользователя */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <span className="text-sm text-gray-700 hidden sm:inline">
                  {user?.name?.split(" ").slice(0, 2).join(" ") || "Сотрудник"}
                </span>
                <div className="w-8 h-8 bg-[#33BBFF] rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {getUserInitials()}
                </div>
              </button>

              {/* Выпадающее меню */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-medium text-gray-800">{user?.name}</p>
                    <p className="text-sm text-gray-500">
                      {user?.department || "СМП бригада"}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Выйти
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <button
        onClick={handleNewCallClick}
        disabled={hasActiveCall}
        className={`px-5 py-2.5 rounded-2xl font-medium transition flex items-center gap-2 shadow-md absolute right-4 bottom-8 ${
          hasActiveCall
            ? "bg-gray-400 cursor-not-allowed text-gray-200"
            : "bg-[#33BBFF] text-white"
        }`}
        title={
          hasActiveCall ? "У вас есть активный вызов" : "Начать новый вызов"
        }
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        {hasActiveCall ? "Вызов активен" : "Начать вызов"}
      </button>

      <main className="mx-auto px-4 lg:px-4 py-6">
        {calls.length === 0 ? (
          <div className="bg-white  rounded-2xl p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Нет вызовов
            </h3>
            <p className="text-gray-500 mb-6">
              Нажмите кнопку "+ Новый вызов" для создания нового
            </p>
            <button
              onClick={handleNewCallClick}
              disabled={hasActiveCall}
              className={`px-5 mx-auto py-2.5 rounded-2xl font-medium transition flex  items-center gap-2 ${
                hasActiveCall
                  ? "bg-gray-400 cursor-not-allowed text-gray-200"
                  : "bg-[#33BBFF]  text-white"
              }`}
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Новый вызов
            </button>
            {hasActiveCall && (
              <p className="text-sm text-gray-400 mt-2">
                ⚠️ У вас уже есть активный вызов. Завершите его перед началом
                нового.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      №
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Пациент
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Адрес
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Время
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Пункт назначения
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calls.map((call, index) => (
                    <tr key={call.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-600 w-2">
                        {calls.length - index}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800 w-32 min-w-[100px] truncate">
                        {call.patientName}
                        
                      </td>
                      <td className="px-6 my-4 text-gray-600 max-w-[400px] line-clamp-2">
                        {call.address}
                        
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm w-32 whitespace-nowrap min-w-[100px]">
                        {call.time}
                      </td>
                      <td className="px-6 py-4 w-28 flex-col flex items-start min-w-[200px] gap-2">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${getStatusColor(call.status)}`}
                        >
                          {getStatusText(call.status)}
                          
                        </span>
                        <span className="text-black text-sm opacity-20">Причина: {call.reason}</span>
                        
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm min-w-[200px]">
                        <div className="flex flex-col items-start justify-center gap-1">
                          <span className="truncate">
                            {call.destination || "—"}
                          </span>
                          {call.status === "active" && call.destination && (
                            <Link
                              href={`/map/${call.id}?dest=${encodeURIComponent(call.destination)}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium whitespace-nowrap w-full"
                            >
                              Показать на карте →
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 w-32">
                        {call.status === "active" ? (
                          <button
                            onClick={() => {
                              const reason = prompt(
                                "Укажите причину завершения вызова:",
                              );
                              if (reason !== null && reason.trim()) {
                                const updated = cancelCall(call.id, reason);
                                if (updated) {
                                  loadCalls();
                                }
                              } else if (reason !== null) {
                                alert("Причина завершения не указана");
                              }
                            }}
                            className="px-3 py-1.5 border-1 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-medium rounded-lg transition whitespace-nowrap"
                          >
                            Завершить
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Модальное окно нового вызова */}
      {showNewCall && (
        <NewCallModal
          onClose={() => {
            setShowNewCall(false);
            loadCalls(); // Обновляем список после закрытия
          }}
        />
      )}
    </div>
  );
}

// Компонент модального окна нового вызова
function NewCallModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"checklist" | "loading" | "result">(
    "checklist",
  );
  const [checklist, setChecklist] = useState({
    acute: false,
    lams: false,
    time: false,
  });
  const [result, setResult] = useState<{
    address: string;
    type: string;
    district: string;
  } | null>(null);
  const [patientInfo, setPatientInfo] = useState({
    name: "",
    address: "",
    district: "Ленинский район",
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Состояния для автодополнения адреса
  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ display_name: string; lat: string; lon: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const allFirstOptions =
    !checklist.acute && !checklist.lams && !checklist.time;
  const allSecondOptions = checklist.acute && checklist.lams && checklist.time;
  const anySecondOption = checklist.acute || checklist.lams || checklist.time;

  const [createdCallId, setCreatedCallId] = useState<string | null>(null);

  // Список районов из данных
  const districts = Array.from(
    new Set(DISTRICT_MAPPINGS.map((m) => m.district)),
  ).sort();

  // Автоматическое определение местоположения при открытии модалки
  useEffect(() => {
    const detectLocation = async () => {
      setIsLoadingLocation(true);
      setLocationError(null);

      try {
        const position = await getCurrentPosition();
        const addressData = await getAddressFromCoords(
          position.lat,
          position.lng,
        );


        setPatientInfo((prev) => ({
          ...prev,
          address: addressData.address,
          district: addressData.district,
        }));

        setLocationError(null);
      } catch (error) {
        console.error("Ошибка определения местоположения:", error);
        setLocationError(
          "Не удалось определить местоположение. Заполните вручную.",
        );
      } finally {
        setIsLoadingLocation(false);
      }
    };

    detectLocation();
  }, []);

  // Закрытие списка предложений при клике вне него
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Функция обновления адреса по геолокации
  const updateLocation = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const position = await getCurrentPosition();
      const addressData = await getAddressFromCoords(
        position.lat,
        position.lng,
      );

      setPatientInfo((prev) => ({
        ...prev,
        address: addressData.address,
        district: addressData.district,
      }));

      setLocationError(null);
    } catch (error) {
      console.error("Ошибка определения местоположения:", error);
      setLocationError("Не удалось определить местоположение");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Поиск адресов с дебаунсом
  const searchAddress = useCallback(async (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchAddresses(query);
        setAddressSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error("Ошибка поиска:", error);
        setAddressSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Обработчик изменения адреса
  const handleAddressChange = (value: string) => {
    setPatientInfo((prev) => ({ ...prev, address: value }));
    searchAddress(value);

    // Определяем район при ручном вводе
    if (value.length > 2) {
      const foundDistrict = extractDistrictFromAddress(value);
      if (foundDistrict) {
        setPatientInfo((prev) => ({ ...prev, district: foundDistrict }));
      }
    }
  };

  // Выбор адреса из предложений
  const selectAddress = (address: string) => {
    setPatientInfo((prev) => ({ ...prev, address }));
    setShowSuggestions(false);
    setAddressSuggestions([]);

    // Определяем район по выбранному адресу
    const foundDistrict = extractDistrictFromAddress(address);
    if (foundDistrict) {
      setPatientInfo((prev) => ({ ...prev, district: foundDistrict }));
    }
  };

  // Очистка адреса
  const clearAddress = () => {
    setPatientInfo((prev) => ({ ...prev, address: "" }));
    setAddressSuggestions([]);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleStartCall = () => {
    if (!patientInfo.name.trim() || !patientInfo.address.trim()) {
      alert("Пожалуйста, заполните ФИО пациента и адрес");
      return;
    }

    const activeCalls = getActiveCalls();
    if (activeCalls.length > 0) {
      alert(
        `Невозможно начать новый вызов. У вас уже есть активный вызов для пациента "${activeCalls[0].patientName}". Завершите его перед созданием нового.`,
      );
      return;
    }

    setStep("loading");

    setTimeout(() => {
      let destination = getCenterForDistrict(patientInfo.district);
      let centerType = "Сосудистый центр";

      if (allSecondOptions) {
        const center = Object.values(CENTERS_MAP).find(
          (c) => c.type === "with_surgery",
        );
        destination =
          center?.name ||
          "ГАУЗ «Оренбургская областная клиническая больница им. В.И. Войнова»";
        centerType = "Сосудистый центр с операционной";
      } else if (anySecondOption) {
        const center = Object.values(CENTERS_MAP).find(
          (c) => c.type === "without_surgery",
        );
        destination = center?.name || "ГБУЗ «Сорочинская межрайонная больница»";
        centerType = "Сосудистый центр без операционной";
      }

      // 👇 Объявляем переменную resultData
      const resultData = {
        address: destination || "Центр не найден",
        type: centerType,
        district: patientInfo.district,
      };

      setResult(resultData);

      // Создаем вызов сразу
      const newCall = createCall({
        patientName: patientInfo.name,
        address: patientInfo.address,
        district: patientInfo.district,
        destination: resultData.address,
        status: "active",
        checklist: checklist,
      });

      setCreatedCallId(newCall.id);
      setStep("result");
    }, 1500);
  };

  const handleClose = () => {
    if (step === "result" && createdCallId) {
      // Переходим на карту с ID уже созданного вызова
      router.push(
        `/map/${createdCallId}?dest=${encodeURIComponent(result?.address || "")}`,
      );
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {step === "checklist" && "Новый вызов"}
            {step === "loading" && "Поиск ближайшего центра..."}
            {step === "result" && "Результат маршрутизации"}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 p-2 transition hover:bg-black/4 rounded-xl "
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === "checklist" && (
            <div className="space-y-6">
              {/* Информация о пациенте */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="font-medium text-gray-700 mb-3">
                  Информация о пациенте
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ФИО пациента *
                    </label>
                    <input
                      type="text"
                      value={patientInfo.name}
                      autoFocus
                      onChange={(e) =>
                        setPatientInfo({ ...patientInfo, name: e.target.value })
                      }
                      placeholder="Иванов Иван Иванович"
                      className="w-full px-4 text-black py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Адрес вызова *
                    </label>
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        value={patientInfo.address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        onFocus={() => {
                          if (
                            addressSuggestions.length > 0 &&
                            patientInfo.address.length >= 3
                          ) {
                            setShowSuggestions(true);
                          }
                        }}
                        placeholder="Введите адрес или используйте геолокацию..."
                        className="w-full px-4 py-2 text-black border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-18"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        {/* Кнопка обновления геолокации */}
                        <button
                          onClick={updateLocation}
                          disabled={isLoadingLocation}
                          className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition disabled:opacity-50 flex items-center gap-1"
                          title="Определить местоположение"
                        >
                          {isLoadingLocation ? (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg
                              className="w-4 h-4 scale-x-[-1]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          )}
                        </button>
                        {patientInfo.address && (
                          <button
                            onClick={clearAddress}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                            title="Очистить адрес"
                          >
                            <svg
                              className="w-4 h-4"
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
                        )}
                        {isSearching && (
                          <div className="p-1.5">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>

                      {/* Список предложений адресов */}
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50"
                        >
                          {addressSuggestions.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => selectAddress(item.display_name)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition flex items-start gap-2 border-b border-gray-50 last:border-none"
                            >
                              <svg
                                className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              <span className="text-gray-700">
                                {item.display_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Введите адрес вручную, если он не определился вручную
                    </p>
                    {locationError && (
                      <p className="text-xs text-red-500 mt-1">
                        {locationError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Район *
                    </label>
                    <select
                      value={patientInfo.district}
                      onChange={(e) =>
                        setPatientInfo({
                          ...patientInfo,
                          district: e.target.value,
                        })
                      }
                      className="w-full px-4 text-black py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      {districts.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Район автоматически определен по адресу
                    </p>
                  </div>
                </div>
              </div>

              {/* Чек-лист */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-medium text-gray-700 mb-3">
                  Чек-лист инсульта
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      1. Острое начало
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist({ ...checklist, acute: false })
                        }
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                          !checklist.acute
                            ? "bg-[#33BBFF] text-white shadow-md "
                            : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Нет
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist({ ...checklist, acute: true })
                        }
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                          checklist.acute
                            ? "bg-[#33BBFF] text-white shadow-md "
                            : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Да
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      2. Оценка по шкале LAMS
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist({ ...checklist, lams: false })
                        }
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                          !checklist.lams
                            ? "bg-[#33BBFF] text-white shadow-md "
                            : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {"< 4 баллов"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist({ ...checklist, lams: true })
                        }
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                          checklist.lams
                            ? "bg-[#33BBFF] text-white shadow-md "
                            : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {"≥ 4 баллов"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      3. Время от начала симптомов
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist({ ...checklist, time: false })
                        }
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                          !checklist.time
                            ? "bg-[#33BBFF] text-white shadow-md "
                            : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {"< 6 часов"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setChecklist({ ...checklist, time: true })
                        }
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                          checklist.time
                            ? "bg-[#33BBFF] text-white shadow-md "
                            : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {"≥ 6 часов"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleStartCall}
                  disabled={
                    !anySecondOption ||
                    !patientInfo.name.trim() ||
                    !patientInfo.address.trim()
                  }
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                    anySecondOption &&
                    patientInfo.name.trim() &&
                    patientInfo.address.trim()
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {allFirstOptions
                    ? "Нет показаний для госпитализации"
                    : "Начать вызов →"}
                </button>
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-600">
                Поиск ближайшего сосудистого центра...
              </p>
              <p className="text-sm text-gray-400">
                Определение местоположения и проверка доступности
              </p>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl ${
                  allSecondOptions
                    ? "bg-red-50 border border-red-200"
                    : "bg-green-50 border border-green-200"
                }`}
              >
                <p className="text-sm font-medium text-gray-700">
                  Рекомендованный центр:
                </p>
                <h3 className="text-xl font-bold text-gray-800 mt-1">
                  {result.address}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    allSecondOptions ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {result.type}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Район: {result.district}
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full bg-blue-600  text-white font-medium py-3 rounded-xl transition shadow-md"
              >
                Перейти к маршруту
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
