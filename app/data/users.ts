// app/data/users.ts - Данные пользователей
export interface User {
  id: string;
  login: string;
  password: string;
  name: string;
  role: 'feldsher' | 'operator' | 'admin';
  department?: string;
}

// Хранилище пользователей (имитация БД)
export const USERS: User[] = [
  {
    id: '1',
    login: 'feldsher',
    password: '123',
    name: 'Иванов И.И.',
    role: 'feldsher',
    department: 'СМП Бригада №1'
  },
];

// Авторизация пользователя
export function authenticateUser(login: string, password: string): User | null {
  const user = USERS.find(u => u.login === login && u.password === password);
  return user || null;
}

// Получить пользователя по ID
export function getUserById(id: string): User | undefined {
  return USERS.find(u => u.id === id);
}