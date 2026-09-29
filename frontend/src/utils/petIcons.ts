import { MaterialCommunityIcons } from '@expo/vector-icons';

type PetIconInfo = {
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  bgColor: string;
};

const PET_ICONS: PetIconInfo[] = [
  { iconName: 'cat', color: '#7C3AED', bgColor: '#F3E8FF' },      // purple
  { iconName: 'dog', color: '#D97706', bgColor: '#FEF3C7' },      // amber
  { iconName: 'fish', color: '#0284C7', bgColor: '#E0F2FE' },     // sky blue
  { iconName: 'bird', color: '#059669', bgColor: '#ECFDF5' },     // emerald
  { iconName: 'rabbit', color: '#D946EF', bgColor: '#FDF4FF' },   // fuchsia
  { iconName: 'turtle', color: '#65A30D', bgColor: '#ECFCCB' },   // lime
  { iconName: 'snake', color: '#475569', bgColor: '#F1F5F9' },    // slate
  { iconName: 'spider', color: '#B91C1C', bgColor: '#FEF2F2' },   // red
  { iconName: 'bug', color: '#EA580C', bgColor: '#FFF7ED' },      // orange
];

const FALLBACK: PetIconInfo = { iconName: 'paw', color: '#BE185D', bgColor: '#FCE7F3' };

/**
 * Match a free-text species string to an icon.
 * Tries exact keyword match first, then falls back to a generic paw.
 */
export function getPetIconInfo(species: string): PetIconInfo {
  const lower = (species || '').toLowerCase().trim();

  for (const entry of PET_ICONS) {
    if (lower.includes(entry.iconName)) return entry;
  }

  // Secondary keyword aliases
  if (lower.includes('feline') || lower.includes('kitten')) return PET_ICONS[0]; // cat
  if (lower.includes('canine') || lower.includes('puppy'))  return PET_ICONS[1]; // dog
  if (lower.includes('aquarium') || lower.includes('goldfish') || lower.includes('betta')) return PET_ICONS[2]; // fish
  if (lower.includes('parrot') || lower.includes('cockatiel') || lower.includes('budgie')) return PET_ICONS[3]; // bird
  if (lower.includes('bunny') || lower.includes('hare'))    return PET_ICONS[4]; // rabbit
  if (lower.includes('tortoise'))                            return PET_ICONS[5]; // turtle
  if (lower.includes('lizard') || lower.includes('gecko'))  return PET_ICONS[6]; // snake-adjacent
  if (lower.includes('scorpion'))                            return PET_ICONS[7]; // spider-adjacent

  return FALLBACK;
}
