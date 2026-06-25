// app/data/calls.ts - Полностью переработанное хранилище вызовов
export interface Call {
  id: string;
  patientName: string;
  address: string;
  district: string;
  time: string;
  status: 'active' | 'completed' | 'canceled';
  destination?: string;
  reason?: string;
  checklist?: {
    acute: boolean;
    lams: boolean;
    time: boolean;
  };
  createdAt: string;
}

// Ключ для localStorage
const STORAGE_KEY = 'smp_calls';

// Получить все вызовы из localStorage
export function getCalls(): Call[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading calls:', error);
    return [];
  }
}

// Сохранить вызовы в localStorage
function saveCalls(calls: Call[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
  } catch (error) {
    console.error('Error saving calls:', error);
  }
}

// Получить вызов по ID
export function getCallById(id: string): Call | undefined {
  const calls = getCalls();
  return calls.find(call => call.id === id);
}

// Создать новый вызов
export function createCall(callData: Omit<Call, 'id' | 'time' | 'createdAt'>): Call {
  const calls = getCalls();
  const newCall: Call = {
    ...callData,
    id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    createdAt: new Date().toISOString()
  };
  
  calls.unshift(newCall);
  saveCalls(calls);
  return newCall;
}

// Обновить вызов
export function updateCall(id: string, updates: Partial<Call>): Call | undefined {
  const calls = getCalls();
  const index = calls.findIndex(call => call.id === id);
  
  if (index === -1) return undefined;
  
  calls[index] = { ...calls[index], ...updates };
  saveCalls(calls);
  return calls[index];
}

// Завершить вызов
export function completeCall(id: string, reason?: string): Call | undefined {
  return updateCall(id, {
    status: 'completed',
    reason: reason || 'Прибытие на место'
  });
}

// Отменить вызов
export function cancelCall(id: string, reason: string): Call | undefined {
  return updateCall(id, {
    status: 'canceled',
    reason
  });
}

// Удалить все вызовы (для тестирования)
export function clearAllCalls(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// Получить активные вызовы
export function getActiveCalls(): Call[] {
  const calls = getCalls();
  return calls.filter(call => call.status === 'active');
}

// Получить завершенные вызовы
export function getCompletedCalls(): Call[] {
  const calls = getCalls();
  return calls.filter(call => call.status === 'completed' || call.status === 'canceled');
}

// Обновить статус вызова с проверкой геолокации
export function updateCallWithLocation(
  id: string, 
  status: 'active' | 'completed' | 'canceled',
  location?: { lat: number; lng: number }
): Call | undefined {
  const calls = getCalls();
  const index = calls.findIndex(call => call.id === id);
  
  if (index === -1) return undefined;
  
  calls[index] = { 
    ...calls[index], 
    status,
    ...(location && { lastLocation: location })
  };
  
  saveCalls(calls);
  return calls[index];
}