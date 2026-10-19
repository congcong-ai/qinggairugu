export const colors = {
  background: '#F7F4EE',
  surface: '#FFFFFF',
  ink: '#282F28',
  muted: '#72786C',
  primary: '#426B4E',
  soft: '#E8EDE1',
  accent: '#EBBA7B',
  border: '#E2E5DB',
  danger: '#AD443B',
} as const;
export const typography = {
  hero: 36,
  title: 26,
  body: 17,
  caption: 13,
} as const;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
export const radius = { sm: 12, md: 20, lg: 32, pill: 999 } as const;
export const shadow = { color: '#282F28', opacity: 0.05, radius: 16 } as const;
export const motion = { short: 160, normal: 260 } as const;
