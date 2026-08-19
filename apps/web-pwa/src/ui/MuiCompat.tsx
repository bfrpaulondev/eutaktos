import {
  Stack as MuiStack,
  Typography as MuiTypography,
  type StackProps as MuiStackProps,
  type TypographyProps as MuiTypographyProps,
} from '@mui/material';

// Material UI v9 intentionally removed several legacy System props from component
// top-level props. These tiny wrappers keep Eutaktos call sites concise while routing
// those values into `sx`, which is the supported v9 API. They add no visual behavior.

type ResponsiveCssValue = string | number | Record<string, string | number | undefined>;

export interface StackProps extends MuiStackProps {
  alignItems?: ResponsiveCssValue;
  justifyContent?: ResponsiveCssValue;
  flexWrap?: ResponsiveCssValue;
  gap?: ResponsiveCssValue;
}

export function Stack({ alignItems, justifyContent, flexWrap, gap, sx, ...props }: StackProps) {
  return (
    <MuiStack
      {...props}
      sx={{
        ...(alignItems !== undefined ? { alignItems } : {}),
        ...(justifyContent !== undefined ? { justifyContent } : {}),
        ...(flexWrap !== undefined ? { flexWrap } : {}),
        ...(gap !== undefined ? { gap } : {}),
        ...(sx as object),
      }}
    />
  );
}

export interface TypographyProps extends MuiTypographyProps {
  fontWeight?: string | number;
}

export function Typography({ fontWeight, sx, ...props }: TypographyProps) {
  return (
    <MuiTypography
      {...props}
      sx={{
        ...(fontWeight !== undefined ? { fontWeight } : {}),
        ...(sx as object),
      }}
    />
  );
}
