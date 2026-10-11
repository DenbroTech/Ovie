import { toIso } from './dates';

export interface Meal { id: string; name: string; emoji: string | null; notes: string | null }
/** A meal put on a day: an all-day calendar event linked to the meal. */
export interface PlannedMeal { id: string; meal_id: string | null; starts_at: string; title: string }

export const MEAL_EMOJIS = [
  '🍕', '🌭', '🍔', '🌮', '🌯', '🍝', '🍜', '🍛', '🍣', '🥘', '🍲', '🥗',
  '🍗', '🥩', '🐟', '🍤', '🥪', '🥟', '🍳', '🥞', '🧆', '🫕', '🥔', '🍽️',
];

export const mealTitle = (m: { name: string; emoji: string | null }) => `${m.emoji ? `${m.emoji} ` : ''}${m.name.trim()}`;

/** One planned meal per day (the first if there are several), keyed by the day it's on. */
export function plannedByDay(planned: PlannedMeal[]): Record<string, PlannedMeal> {
  const out: Record<string, PlannedMeal> = {};
  for (const p of planned) {
    const day = toIso(new Date(p.starts_at));
    if (!out[day]) out[day] = p;
  }
  return out;
}

/** "Dinner" instead of "All day" for planned meals on calendars and the wall. */
export const eventWhenLabel = (e: { all_day: boolean; meal_id?: string | null }, time: () => string) =>
  e.meal_id ? 'Dinner' : e.all_day ? 'All day' : time();
