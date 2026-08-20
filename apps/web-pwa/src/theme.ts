import { alpha, createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';
import type { Density, PaletteId, TextSize } from './lib/preferences';
import { textDirectionForLocale } from './lib/textDirection';

export interface EutaktosPalette {
  id: PaletteId;
  label: string;
  colors: readonly [string, string, string, string, string];
  mode: 'light' | 'dark';
}

export const EUTAKTOS_PALETTES: Record<PaletteId, EutaktosPalette> = {
  classic: { id: 'classic', label: '1. Neutro Clássico', colors: ['#FAFAFA', '#F2F2F2', '#1A1A1A', '#6B6B6B', '#3B82F6'], mode: 'light' },
  warm: { id: 'warm', label: '2. Neutro Quente', colors: ['#F7F3EE', '#EDE8E0', '#2C2926', '#8A837B', '#C17B5C'], mode: 'light' },
  green: { id: 'green', label: '3. Monocromático + Verde', colors: ['#FFFFFF', '#F5F5F5', '#222222', '#777777', '#5B8A72'], mode: 'light' },
  blue: { id: 'blue', label: '4. Azul Pastel', colors: ['#F0F5F9', '#FFFFFF', '#1E3A5F', '#64748B', '#3B82F6'], mode: 'light' },
  dark: { id: 'dark', label: '5. Dark Mode Minimalista', colors: ['#121212', '#1E1E1E', '#EDEDED', '#A0A0A0', '#60A5FA'], mode: 'dark' },
  pastel: { id: 'pastel', label: '6. Pastel Suave', colors: ['#FDF8F4', '#F8EDE8', '#3F3A37', '#8C8179', '#D4A5A5'], mode: 'light' },
};

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

function isReadableOnBoth(foreground: string, background: string, surface: string, minimum = 4.5): boolean {
  return contrastRatio(foreground, background) >= minimum && contrastRatio(foreground, surface) >= minimum;
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
  const [background, surface, text, muted, accent] = selected.colors;
  const compact = density === 'compact';
  const transparentSurface = reducedTransparency ? surface : alpha(surface, selected.mode === 'dark' ? 0.86 : 0.78);

  const secondaryText = isReadableOnBoth(muted, background, surface) ? muted : text;
  const focusColor = isReadableOnBoth(accent, background, surface, 3) ? accent : text;

  let theme = createTheme({
    direction: textDirectionForLocale(locale),
    palette: {
      mode: selected.mode,
      primary: { main: text, contrastText: background },
      secondary: { main: accent, contrastText: text },
      background: { default: background, paper: surface },
      text: { primary: text, secondary: secondaryText },
      divider: highContrast ? text : alpha(muted, 0.32),
    },
    shape: { borderRadius: 18 },
    spacing: compact ? 7 : 8,
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 720, letterSpacing: '-0.045em', lineHeight: 1.03 },
      h2: { fontWeight: 690, letterSpacing: '-0.03em' },
      h3: { fontWeight: 680, letterSpacing: '-0.02em' },
      button: { textTransform: 'none', fontWeight: 700 },
    },
    transitions: {
      duration: reducedMotion
        ? { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 }
        : undefined,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: selected.mode,
            backgroundColor: background,
            fontSize: `${TEXT_SIZE_PERCENT[textSize]}%`,
          },
          body: {
            backgroundColor: background,
            backgroundImage: reducedTransparency
              ? 'none'
              : `radial-gradient(circle at 18% 8%, ${alpha(accent, 0.10)}, transparent 32%), radial-gradient(circle at 82% 18%, ${alpha(muted, 0.08)}, transparent 30%)`,
            minWidth: 320,
          },
          '*': { boxSizing: 'border-box' },
          '*:focus-visible': {
            outline: `3px solid ${focusColor}`,
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
            backgroundColor: transparentSurface,
            backgroundImage: 'none',
            border: `${highContrast ? 2 : 1}px solid ${highContrast ? text : alpha(muted, 0.24)}`,
            backdropFilter: reducedTransparency ? 'none' : 'blur(18px) saturate(118%)',
            WebkitBackdropFilter: reducedTransparency ? 'none' : 'blur(18px) saturate(118%)',
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: transparentSurface,
            border: `${highContrast ? 2 : 1}px solid ${highContrast ? text : alpha(muted, 0.24)}`,
            transition: reducedMotion ? 'none' : 'transform 160ms ease, border-color 160ms ease',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 14,
            paddingInline: compact ? 14 : 18,
            transition: reducedMotion ? 'none' : 'transform 140ms ease, background-color 140ms ease',
            '&:active': reducedMotion ? undefined : { transform: 'scale(0.985)' },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: alpha(accent, 0.18) },
          bar: { backgroundColor: accent },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: accent,
              '& + .MuiSwitch-track': { backgroundColor: accent, opacity: 0.5 },
            },
          },
        },
      },
      MuiSelect: {
        defaultProps: { size: compact ? 'small' : 'medium' },
      },
    },
  });

  theme = responsiveFontSizes(theme, { factor: 2.2 });
  return theme;
}
