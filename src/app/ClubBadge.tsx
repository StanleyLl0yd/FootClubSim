import type { ClubIdentity } from '../branding/identities.js';

/** Scalable, project-authored geometry. No externally supplied crest artwork. */
export function ClubBadge({ club, size = 60 }: { readonly club: ClubIdentity; readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img"
      aria-label={`Эмблема: ${club.name}`} focusable="false">
      <circle cx="50" cy="50" r="49" fill={club.outerColor} />
      <circle cx="50" cy="50" r="40" fill={club.middleColor} />
      <circle cx="50" cy="50" r="31" fill={club.centerColor} />
      <text x="50" y={club.subtitle ? 61 : 67} textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontWeight="800"
        fontSize={club.subtitle ? 51 : 54} fill={club.letterColor}>{club.letter}</text>
      {club.subtitle && <text x="50" y="82" textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontWeight="800"
        fontSize="19" fill={club.letterColor}>{club.subtitle}</text>}
    </svg>
  );
}
