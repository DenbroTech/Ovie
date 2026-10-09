// Ovie the sheep — mascot and logo. Pure SVG so it is crisp on every screen.
type Mood = 'happy' | 'sleepy';

const FLEECE: Array<[number, number, number]> = [
  [38, 62, 16], [49, 47, 16], [67, 44, 17], [84, 56, 16],
  [85, 75, 15], [67, 86, 16], [46, 83, 15], [62, 64, 26],
];

export function OvieSheep({
  size = 96,
  mood = 'happy',
  title = 'Ovie the sheep',
}: {
  size?: number;
  mood?: Mood;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      className="ovie-sheep"
    >
      <title>{title}</title>
      {/* legs */}
      <rect x="47" y="92" width="8" height="15" rx="4" fill="var(--sheep-face, #3b332c)" />
      <rect x="65" y="92" width="8" height="15" rx="4" fill="var(--sheep-face, #3b332c)" />
      {/* fleece: outline pass, then fill pass so only the outer edge shows */}
      <g fill="var(--sheep-wool-edge, #e3d9c8)">
        {FLEECE.map(([cx, cy, r], i) => <circle key={`o${i}`} cx={cx} cy={cy} r={r + 2.2} />)}
      </g>
      <g fill="var(--sheep-wool, #fffaf1)">
        {FLEECE.map(([cx, cy, r], i) => <circle key={`f${i}`} cx={cx} cy={cy} r={r} />)}
      </g>
      {/* ears */}
      <ellipse cx="41" cy="64" rx="9" ry="5" transform="rotate(-20 41 64)" fill="var(--sheep-face, #3b332c)" />
      <ellipse cx="79" cy="64" rx="9" ry="5" transform="rotate(20 79 64)" fill="var(--sheep-face, #3b332c)" />
      {/* face */}
      <ellipse cx="60" cy="72" rx="15" ry="18" fill="var(--sheep-face, #3b332c)" />
      {/* tuft */}
      <g fill="var(--sheep-wool, #fffaf1)">
        <circle cx="53" cy="55" r="7" />
        <circle cx="61" cy="52" r="8" />
        <circle cx="68" cy="56" r="6" />
      </g>
      {mood === 'happy' ? (
        <g>
          <circle cx="54" cy="70" r="4.2" fill="#fff" />
          <circle cx="66" cy="70" r="4.2" fill="#fff" />
          <circle cx="54.8" cy="70.8" r="2.3" fill="#1d1813" />
          <circle cx="66.8" cy="70.8" r="2.3" fill="#1d1813" />
        </g>
      ) : (
        <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M50.5 71 q3.5 2.5 7 0" />
          <path d="M62.5 71 q3.5 2.5 7 0" />
        </g>
      )}
      <circle cx="49.5" cy="79" r="3" fill="#e89a8c" opacity="0.55" />
      <circle cx="70.5" cy="79" r="3" fill="#e89a8c" opacity="0.55" />
      <path d="M56 82.5 q4 3 8 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
