import {
  CssBaseline,
  Stack as MuiStack,
  ThemeProvider,
  Typography as MuiTypography,
  type StackProps as MuiStackProps,
  type Theme,
  type TypographyProps as MuiTypographyProps,
} from '@mui/material';
import type { ReactNode } from 'react';

// Temporary bridge for the final PX11 retirement slices. Legacy MUI consumers remain
// behind this file while migrated application surfaces stay free of direct MUI imports.
// Remove this module after the remaining consumers and theme builder have moved to Ant.

type ResponsiveCssValue = string | number | Record<string, string | number | undefined>;

export function LegacyMuiThemeBridge({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}

export interface StackProps extends MuiStackProps {
  alignItems?: ResponsiveCssValue;
  justifyContent?: ResponsiveCssValue;
  flexWrap?: ResponsiveCssValue;
  gap?: ResponsiveCssValue;
}

export function Stack({ alignItems, justifyContent, flexWrap, gap, sx, ...props }: StackProps) {
  return <MuiStack {...props} sx={{ ...(alignItems !== undefined ? { alignItems } : {}), ...(justifyContent !== undefined ? { justifyContent } : {}), ...(flexWrap !== undefined ? { flexWrap } : {}), ...(gap !== undefined ? { gap } : {}), ...(sx as object) }} />;
}

export interface TypographyProps extends MuiTypographyProps { fontWeight?: string | number; }

export function Typography({ fontWeight, sx, ...props }: TypographyProps) {
  return <MuiTypography {...props} sx={{ ...(fontWeight !== undefined ? { fontWeight } : {}), ...(sx as object) }} />;
}
