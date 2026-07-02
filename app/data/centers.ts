// app/data/centers.ts - Данные сосудистых центров
export interface Center {
  name: string;
  lat: number;
  lng: number;
  address: string;
  type: 'with_surgery' | 'without_surgery';
  typeLabel: string;
  district: string;
}

export const CENTERS: Center[] = [
  {
    name: 'ГАУЗ «Оренбургская областная клиническая больница им. В.И. Войнова»',
    lat: 51.77428, 
    lng: 55.12055,
    address: 'г. Оренбург, улица Аксакова, дом 23',
    type: 'with_surgery',
    typeLabel: 'Сосудистый центр с операционной',
    district: 'Центральный район'
  },
  {
    name: 'ГАУЗ «Городская клиническая больница им. Н.И. Пирогова»',
    lat: 51.77623,
    lng: 55.07056,
    address: 'г. Оренбург, ул. Пирогова, 15',
    type: 'with_surgery',
    typeLabel: 'Сосудистый центр с операционной',
    district: 'Дзержинский район'
  },
  {
    name: 'ГАУЗ «Оренбургская областная клиническая больница им. В.И. Войнова»',
    lat: 51.77428, 
    lng: 55.12055,
    address: 'г. Оренбург, улица Аксакова, дом 23',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Центральный район'
  },
  {
    name: 'ГАУЗ «Городская клиническая больница им. Н.И. Пирогова»',
    lat: 51.77623,
    lng: 55.07056,
    address: 'г. Оренбург, ул. Пирогова, 15',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Дзержинский район'
  },
  {
    name: 'ГАУЗ «Городская клиническая больница», г. Орск',
    lat: 51.21818,
    lng: 58.55703,
    address: 'г. Орск, ул. Советская, 45',
    type: 'with_surgery',
    typeLabel: 'Сосудистый центр с операционной',
    district: 'Городской округ город Орск'
  },
  {
    name: 'ГБУЗ «Сорочинская межрайонная больница»',
    lat: 52.42421,
    lng: 53.15415,
    address: 'г. Сорочинск, ул. Ленинская, 12',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Сорочинский городской округ'
  },
  {
    name: 'ГБУЗ «Городская больница» г. Бугуруслана',
    lat: 53.65032,
    lng: 52.43654,
    address: 'г. Бугуруслан, ул. Больничная, 8',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Городской округ города Бугуруслан'
  },
  {
    name: 'ГБУЗ «Октябрьская районная больница»',
    lat: 52.34567,
    lng: 55.50123,
    address: 'с. Октябрьское, ул. Центральная, 20',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Октябрьский муниципальный район'
  },
  {
    name: 'ГБУЗ «Новосергиевская районная больница»',
    lat: 52.10845,
    lng: 53.62231,
    address: 'п. Новосергиевка, ул. Больничная, 3',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Новосергиевский муниципальный район'
  },
  {
    name: 'ГАУЗ «Больница скорой медицинской помощи» г. Новотроицка',
    lat: 51.19678,
    lng: 58.31245,
    address: 'г. Новотроицк, ул. Медицинская, 10',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Городской округ город Новотроицк'
  },
  {
    name: 'ГБУЗ «Городская больница» г. Кувандыка',
    lat: 51.47867,
    lng: 57.34512,
    address: 'г. Кувандык, ул. Больничная, 5',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Кувандыкский городской округ'
  },
  {
    name: 'ГБУЗ «Абдулинская межрайонная больница»',
    lat: 53.67321,
    lng: 53.65432,
    address: 'г. Абдулино, ул. Больничная, 1',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Абдулинский городской округ'
  },
  {
    name: 'ГБУЗ «Ириклинская районная больница»',
    lat: 51.15123,
    lng: 58.62345,
    address: 'п. Ириклинский, ул. Центральная, 10',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Новоорский муниципальный район'
  },
  {
    name: 'ГБУЗ «Бузулукская районная больница»',
    lat: 52.78234,
    lng: 52.26234,
    address: 'г. Бузулук, ул. Ленина, 45',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Бузулукский муниципальный район'
  },
  {
    name: 'ГБУЗ «Гайская городская больница»',
    lat: 51.46678,
    lng: 58.43321,
    address: 'г. Гай, ул. Больничная, 7',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Гайский городской округ'
  },
  {
    name: 'ГБУЗ «Медногорская городская больница»',
    lat: 51.41234,
    lng: 57.61234,
    address: 'г. Медногорск, ул. Ленина, 12',
    type: 'without_surgery',
    typeLabel: 'Сосудистый центр',
    district: 'Городской округ город Медногорск'
  }
];

// Словарь для быстрого поиска по названию
export const CENTERS_MAP: Record<string, Center> = CENTERS.reduce((acc, center) => {
  acc[center.name] = center;
  return acc;
}, {} as Record<string, Center>);

// Получить центр по названию
export function getCenterByName(name: string): Center | undefined {
  return CENTERS_MAP[name];
}

// Получить центры по типу
export function getCentersByType(type: 'with_surgery' | 'without_surgery'): Center[] {
  return CENTERS.filter(center => center.type === type);
}

// Получить центр по району
export function getCenterByDistrict(district: string): Center | undefined {
  return CENTERS.find(center => center.district === district);
}

// Получить ближайший центр
export function getNearestCenter(lat: number, lng: number, type?: 'with_surgery' | 'without_surgery'): Center | null {
  let centers = CENTERS;
  if (type) {
    centers = centers.filter(c => c.type === type);
  }
  
  if (centers.length === 0) return null;
  
  let nearest = centers[0];
  let minDistance = calculateDistance(lat, lng, nearest.lat, nearest.lng);
  
  for (let i = 1; i < centers.length; i++) {
    const distance = calculateDistance(lat, lng, centers[i].lat, centers[i].lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = centers[i];
    }
  }
  
  return nearest;
}

// Расчет расстояния между двумя точками (в километрах)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}