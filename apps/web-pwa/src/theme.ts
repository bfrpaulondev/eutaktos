import { alpha, createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';
import type { Density, PaletteId, TextSize } from './lib/preferences';
import { textDirectionForLocale } from './lib/textDirection';

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
  success: '#3D775D',
  pending: '#A66316',
  warning: '#A85C11',
  error: '#B53A4B',
  info: '#2F6F9E',
  inactive: '#63737A',
  draft: '#59757B',
  confirmed: '#3D775D',
};

export const EUTAKTOS_PALETTES: Record<PaletteId, EutaktosPalette> = {
  classic: {
    id: 'classic',
    label: 'Clássica',
    mode: 'light',
    colors: ['#F4F7F7', '#FFFFFF', '#20353A', '#53666B', '#2F6F73'],
    background: '#F4F7F7',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    text: '#20353A',
    muted: '#53666B',
    primary: '#2F6F73',
    primaryContrast: '#FFFFFF',
    focus: '#145F68',
    status: sharedStatus,
  },
  warm: {
    id: 'warm',
    label: 'Acolhedora',
    mode: 'light',
    colors: ['#FAF6F0', '#FFFDFC', '#3A312A', '#65584D', '#875F43'],
    background: '#FAF6F0',
    surface: '#FFFDFC',
    elevated: '#FFFFFF',
    text: '#3A312A',
    muted: '#65584D',
    primary: '#875F43',
    primaryContrast: '#FFFFFF',
    focus: '#70482E',
    status: sharedStatus,
  },
  green: {
    id: 'green',
    label: 'Calma',
    mode: 'light',
    colors: ['#F3F7F2', '#FCFDFC', '#26382D', '#526458', '#50775E'],
    background: '#F3F7F2',
    surface: '#FCFDFC',
    elevated: '#FFFFFF',
    text: '#26382D',
    muted: '#526458',
    primary: '#50775E',
    primaryContrast: '#FFFFFF',
    focus: '#376845',
    status: sharedStatus,
  },
  blue: {
    id: 'blue',
    label: 'Foco',
    mode: 'light',
    colors: ['#F3F6FA', '#FCFDFF', '#263451', '#52617A', '#315C7D'],
    background: '#F3F6FA',
    surface: '#FCFDFF',
    elevated: '#FFFFFF',
    text: '#263451',
    muted: '#52617A',
    primary: '#315C7D',
    primaryContrast: '#FFFFFF',
    focus: '#234E70',
    status: sharedStatus,
  },
  dark: {
    id: 'dark',
    label: 'Noturna',
    mode: 'dark',
    colors: ['#111B22', '#182630', '#EAF1F2', '#B7C6C9', '#6BC7C4'],
    background: '#111B22',
    surface: '#182630',
    elevated: '#21323D',
    text: '#EAF1F2',
    muted: '#B7C6C9',
    primary: '#6BC7C4',
    primaryContrast: '#10242A',
    focus: '#9AE5DE',
    status: {
      success: '#83C7A3',
      pending: '#F0BC72',
      warning: '#F0B568',
      error: '#FF9CA8',
      info: '#83C5F3',
      inactive: '#B7C6C9',
      draft: '#9CC8CF',
      confirmed: '#83C7A3',
    },
  },
  pastel: {
    id: 'pastel',
    label: 'Alto contraste',
    mode: 'light',
    colors: ['#FFFFFF', '#FFFFFF', '#152027', '#3D4F59', '#174C57'],
    background: '#FFFFFF',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    text: '#152027',
    muted: '#3D4F59',
    primary: '#174C57',
    primaryContrast: '#FFFFFF',
    focus: '#0F6470',
    status: {
      success: '#1E634A',
      pending: '#8D5000',
      warning: '#8D5000',
      error: '#9B1C31',
      info: '#195D8A',
      inactive: '#40515A',
      draft: '#315A64',
      confirmed: '#1E634A',
    },
  },
};

export const EUTAKTOS_STATUS_KEYS = ['success', 'pending', 'warning', 'error', 'info', 'inactive', 'draft', 'confirmed'] as const;
export type EutaktosStatusKey = typeof EUTAKTOS_STATUS_KEYS[number];

const TEXT_SIZE_PERCENT: Record<TextSize, number> = {
  small: 87.5,
  default: 100,
  large: 112.5,
  'extra-large': 125,
};

interface ThemeOptionsInput {
  paletteId: PaletteId;
  density: Density;
  locale?: string;
  textSize?: TextSize;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  highContrast: boolean;
}

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

function readableText(candidate: string, background: string, fallback: string, minimum = 4.5): string {
  return contrastRatio(candidate, background) >= minimum ? candidate : fallback;
}

export function statusColor(paletteId: PaletteId, status: EutaktosStatusKey): string {
  return EUTAKTOS_PALETTES[paletteId].status[status];
}

export function buildEutaktosTheme({
  paletteId,
  density,
  locale = 'en',
  textSize = 'default',
  reducedMotion,
  reducedTransparency,
  highContrast,
}: ThemeOptionsInput): Theme {
  const selected = EUTAKTOS_PALETTES[paletteId];
  const compact = density === 'compact';
  const surfaceAlpha = selected.mode === 'dark' ? 0.96 : 0.92;
  const paper = reducedTransparency ? selected.surface : alpha(selected.surface, surfaceAlpha);
  const secondaryText = readableText(selected.muted, selected.background, selected.text);
  const divider = highContrast ? selected.text : alpha(selected.text, selected.mode === 'dark' ? 0.34 : 0.14);
  const subtleBorder = highContrast ? selected.text : alpha(selected.text, selected.mode === 'dark' ? 0.38 : 0.10);

  let theme = createTheme({
    direction: textDirectionForLocale(locale),
    palette: {
      mode: selected.mode,
      primary: { main: selected.primary, contrastText: selected.primaryContrast },
      secondary: { main: selected.status.info, contrastText: selected.primaryContrast },
      success: { main: selected.status.success, contrastText: selected.mode === 'dark' ? '#10241B' : '#FFFFFF' },
      warning: { main: selected.status.warning, contrastText: '#FFFFFF' },
      error: { main: selected.status.error, contrastText: '#FFFFFF' },
      info: { main: selected.status.info, contrastText: '#FFFFFF' },
      background: { default: selected.background, paper },
      text: { primary: selected.text, secondary: secondaryText },
      divider,
    },
    shape: { borderRadius: 16 },
    spacing: compact ? 7 : 8,
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 760, letterSpacing: '-0.052em', lineHeight: 1.04 },
      h2: { fontWeight: 730, letterSpacing: '-0.038em' },
      h3: { fontWeight: 720, letterSpacing: '-0.024em' },
      h4: { fontWeight: 700, letterSpacing: '-0.018em' },
      button: { textTransform: 'none', fontWeight: 720, letterSpacing: '-0.01em' },
      overline: { fontWeight: 760, letterSpacing: '0.09em', lineHeight: 1.45 },
    },
    transitions: {
      duration: reducedMotion
        ? { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 }
        : { shortest: 120, shorter: 150, short: 180, standard: 220, complex: 280, enteringScreen: 220, leavingScreen: 180 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: selected.mode,
            backgroundColor: selected.background,
            fontSize: `${TEXT_SIZE_PERCENT[textSize]}%`,
          },
          body: {
            backgroundColor: selected.background,
            backgroundImage: reducedTransparency
              ? 'none'
              : `radial-gradient(circle at 18% -8%, ${alpha(selected.primary, selected.mode === 'dark' ? 0.16 : 0.09)}, transparent 30%), radial-gradient(circle at 88% 4%, ${alpha(selected.status.info, selected.mode === 'dark' ? 0.1 : 0.055)}, transparent 25%)`,
            minWidth: 320,
          },
          '*': { boxSizing: 'border-box' },
          '*:focus-visible': {
            outline: `3px solid ${selected.focus}`,
            outlineOffset: 3,
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: paper,
            backgroundImage: 'none',
            border: `${highContrast ? 2 : 1}px solid ${subtleBorder}`,
            boxShadow: highContrast || reducedTransparency ? 'none' : `0 10px 28px ${alpha(selected.text, selected.mode === 'dark' ? 0.14 : 0.055)}`,
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: paper,
            border: `${highContrast ? 2 : 1}px solid ${subtleBorder}`,
            boxShadow: highContrast || reducedTransparency ? 'none' : `0 8px 20px ${alpha(selected.text, selected.mode === 'dark' ? 0.13 : 0.045)}`,
            transition: reducedMotion ? 'none' : 'transform 180ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 180ms cubic-bezier(0.23, 1, 0.32, 1)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 12,
            paddingInline: compact ? 14 : 18,
            transition: reducedMotion ? 'none' : 'transform 150ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms cubic-bezier(0.23, 1, 0.32, 1)',
            '&:active': reducedMotion ? undefined : { transform: 'scale(0.975)' },
          },
          outlined: { borderColor: alpha(selected.primary, selected.mode === 'dark' ? 0.72 : 0.46) },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 700 },
          outlined: { borderColor: subtleBorder },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundColor: selected.elevated, borderColor: subtleBorder },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: alpha(selected.primary, 0.16) },
          bar: { backgroundColor: selected.primary },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: selected.primary,
              '& + .MuiSwitch-track': { backgroundColor: selected.primary, opacity: 0.58 },
            },
          },
        },
      },
      MuiSelect: { defaultProps: { size: compact ? 'small' : 'medium' } },
    },
  });

  theme = responsiveFontSizes(theme, { factor: 2.1 });
  return theme;
}
