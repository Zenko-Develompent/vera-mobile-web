// app/data/checklist.ts - Данные чек-листа
export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  options: {
    value: boolean;
    label: string;
    severity: 'normal' | 'warning' | 'critical';
  }[];
}

export const CHECKLIST: ChecklistItem[] = [
  {
    id: 'acute',
    label: 'Острое начало',
    description: 'Внезапное появление симптомов',
    options: [
      { value: false, label: 'Нет', severity: 'normal' },
      { value: true, label: 'Да', severity: 'critical' }
    ]
  },
  {
    id: 'lams',
    label: 'Оценка по шкале LAMS',
    description: 'Los Angeles Motor Scale',
    options: [
      { value: false, label: '< 4 баллов', severity: 'normal' },
      { value: true, label: '≥ 4 баллов', severity: 'warning' }
    ]
  },
  {
    id: 'time',
    label: 'Время от начала симптомов',
    description: 'С момента появления первых признаков',
    options: [
      { value: false, label: '< 6 часов', severity: 'normal' },
      { value: true, label: '≥ 6 часов', severity: 'warning' }
    ]
  }
];

// Определение тактики на основе чек-листа
export interface RoutingDecision {
  action: 'no_action' | 'send_to_center' | 'send_to_surgery';
  message: string;
  description: string;
  centerType: 'none' | 'without_surgery' | 'with_surgery';
}

export function getRoutingDecision(acute: boolean, lams: boolean, time: boolean): RoutingDecision {
  const allNormal = !acute && !lams && !time;
  const allCritical = acute && lams && time;
  const anyAbnormal = acute || lams || time;

  if (allNormal) {
    return {
      action: 'no_action',
      message: 'Пациент не требует экстренной госпитализации',
      description: 'Все критерии в норме. Рекомендовано наблюдение в амбулаторных условиях.',
      centerType: 'none'
    };
  }

  if (allCritical) {
    return {
      action: 'send_to_surgery',
      message: 'Требуется экстренная доставка в центр с операционной!',
      description: 'Критическое состояние пациента. Необходима срочная госпитализация в центр с операционной.',
      centerType: 'with_surgery'
    };
  }

  return {
    action: 'send_to_center',
    message: 'Требуется маршрутизация в сосудистый центр',
    description: 'Выявлены отклонения в состоянии пациента. Необходима госпитализация в сосудистый центр.',
    centerType: 'without_surgery'
  };
}