// Русские подписи тем разбора комментариев. Копия TOPICS из backend/app/analyzer/models.py:
// меняется там, меняется здесь. Тему positive на карточке не показываем.

export const TOPIC_LABEL: Record<string, string> = {
  tasks_shortage: 'нехватка задач',
  overload: 'перегрузка',
  mentor: 'отношения с наставником',
  clarity: 'непонятные задачи',
  motivation: 'мотивация и интерес',
  team: 'команда',
  growth: 'рост и обучение',
}

export function topicLabels(topics: readonly string[]): string[] {
  return topics.filter((t) => t !== 'positive' && TOPIC_LABEL[t]).map((t) => TOPIC_LABEL[t]!)
}
