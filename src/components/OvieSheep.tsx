import { useEffect, useState } from 'react';

// Ovie the sheep — mascot and logo. One picture per mood or app (public/sheep/<mood>.webp).
export const SHEEP_MOODS = [
  'happy', 'sad', 'angry', 'excited', 'worried',
  'sleepy', 'surprised', 'in-love', 'cool', 'silly',
  'shocked', 'tired', 'thinking', 'celebrating', 'hungry',
  'working', 'shopping', 'calendar', 'watch', 'photos', 'alarms', 'finances', 'settings',
] as const;
export type SheepMood = (typeof SHEEP_MOODS)[number];

export const sheepSrc = (mood: SheepMood) => `${import.meta.env.BASE_URL}sheep/${mood}.webp`;

const REACT_EVENT = 'ovie-sheep-react';

/** Make every "reacting" Ovie on screen show a mood for a moment (e.g. celebrating a ticked-off job). */
export function reactSheep(mood: SheepMood, ms = 3000) {
  window.dispatchEvent(new CustomEvent(REACT_EVENT, { detail: { mood, ms } }));
}

export function OvieSheep({
  size = 96,
  mood = 'happy',
  title = 'Ovie the sheep',
  reacts = false,
  className,
}: {
  size?: number;
  mood?: SheepMood;
  title?: string;
  /** Follows reactSheep() for a moment, then goes back to `mood`. */
  reacts?: boolean;
  className?: string;
}) {
  const [reaction, setReaction] = useState<SheepMood | null>(null);
  useEffect(() => {
    if (!reacts) return;
    let timer = 0;
    const on = (e: Event) => {
      const { mood: m, ms } = (e as CustomEvent<{ mood: SheepMood; ms: number }>).detail;
      setReaction(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setReaction(null), ms);
    };
    window.addEventListener(REACT_EVENT, on);
    return () => { window.removeEventListener(REACT_EVENT, on); window.clearTimeout(timer); };
  }, [reacts]);

  const shown = reaction ?? mood;
  return (
    <img
      src={sheepSrc(shown)}
      width={size}
      height={size}
      alt={title}
      draggable={false}
      className={`ovie-sheep${reaction ? ' ovie-sheep-pop' : ''}${className ? ` ${className}` : ''}`}
      key={shown}
    />
  );
}
