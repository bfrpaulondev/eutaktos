import type { PaletteId } from './lib/preferences';

export interface EutaktosStatusColors {
  success: string;
  pending: string;
  warning: string;
  error: string;
  info: string;
  inactive: string;
  draft: string;
  confirmed: string;
}

export interface EutaktosPalette {
  id: PaletteId;
  label: string;
  mode: 'light' | 'dark';
  colors: readonly [string, string, string, string, string];
  background: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  primary: string;
  primaryContrast: string;
  focus: string;
  status: EutaktosStatusColors;
}

const sharedStatus: EutaktosStatusColors = {
  success: '#3D775D', pending: '#A66316', warning: '#A85C11', error: '#B53A4B', info: '#2F6F9E', inactive: '#63737A', draft: '#59757B', confirmed: '#3D775D',
};

export const EUTAKTOS_PALETTES: Record<PaletteId, EutaktosPalette> = {
  classic: { id: 'classic', label: 'Clássica', mode: 'light', colors: ['#F4F7F7', '#FFFFFF', '#20353A', '#53666B', '#2F6F73'], background: '#F4F7F7', surface: '#FFFFFF', elevated: '#FFFFFF', text: '#20353A', muted: '#53666B', primary: '#2F6F73', primaryContrast: '#FFFFFF', focus: '#145F68', status: sharedStatus },
  warm: { id: 'warm', label: 'Acolhedora', mode: 'light', colors: ['#FAF6F0', '#FFFDFC', '#3A312A', '#65584D', '#875F43'], background: '#FAF6F0', surface: '#FFFDFC', elevated: '#FFFFFF', text: '#3A312A', muted: '#65584D', primary: '#875F43', primaryContrast: '#FFFFFF', focus: '#70482E', status: sharedStatus },
  green: { id: 'green', label: 'Calma', mode: 'light', colors: ['#F3F7F2', '#FCFDFC', '#26382D', '#526458', '#50775E'], background: '#F3F7F2', surface: '#FCFDFC', elevated: '#FFFFFF', text: '#26382D', muted: '#526458', primary: '#50775E', primaryContrast: '#FFFFFF', focus: '#376845', status: sharedStatus },
  blue: { id: 'blue', label: 'Foco', mode: 'light', colors: ['#F3F6FA', '#FCFDFF', '#263451', '#52617A', '#315C7D'], background: '#F3F6FA', surface: '#FCFDFF', elevated: '#FFFFFF', text: '#263451', muted: '#52617A', primary: '#315C7D', primaryContrast: '#FFFFFF', focus: '#234E70', status: sharedStatus },
  dark: { id: 'dark', label: 'Noturna', mode: 'dark', colors: ['#111B22', '#182630', '#EAF1F2', '#B7C6C9', '#6BC7C4'], background: '#111B22', surface: '#182630', elevated: '#21323D', text: '#EAF1F2', muted: '#B7C6C9', primary: '#6BC7C4', primaryContrast: '#10242A', focus: '#9AE5DE', status: { success: '#83C7A3', pending: '#F0BC72', warning: '#F0B568', error: '#FF9CA8', info: '#83C5F3', inactive: '#B7C6C9', draft: '#9CC8CF', confirmed: '#83C7A3' } },
  pastel: { id: 'pastel', label: 'Alto contraste', mode: 'light', colors: ['#FFFFFF', '#FFFFFF', '#152027', '#3D4F59', '#174C57'], background: '#FFFFFF', surface: '#FFFFFF', elevated: '#FFFFFF', text: '#152027', muted: '#3D4F59', primary: '#174C57', primaryContrast: '#FFFFFF', focus: '#0F6470', status: { success: '#1E634A', pending: '#8D5000', warning: '#8D5000', error: '#9B1C31', info: '#195D8A', inactive: '#40515A', draft: '#315A64', confirmed: '#1E634A' } },
};

export const EUTAKTOS_STATUS_KEYS = ['success', 'pending', 'warning', 'error', 'info', 'inactive', 'draft', 'confirmed'] as const;
export type EutaktosStatusKey = typeof EUTAKTOS_STATUS_KEYS[number];

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const red = linearize(Number.parseInt(value.slice(0, 2), 16));
  const green = linearize(Number.parseInt(value.slice(2, 4), 16));
  const blue = linearize(Number.parseInt(value.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(candidate: string, surfaces: readonly string[], fallback: string, minimum = 4.5): string {
  return surfaces.every(surface => contrastRatio(candidate, surface) >= minimum) ? candidate : fallback;
}

export function statusColor(paletteId: PaletteId, status: EutaktosStatusKey): string {
  return EUTAKTOS_PALETTES[paletteId].status[status];
}
