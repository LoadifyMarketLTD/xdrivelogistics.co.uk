export const colors = {
  appBackground: '#F1F3F6',
  surface: '#FFFFFF',
  text: '#172033',
  muted: '#475569',
  border: '#C9C9C9',
  primary: '#2DA15F',
  primaryDark: '#23834C',
  info: '#E6F0FF',
  notice: '#FFF8C7',
  iconWell: '#F1F1F1',
  danger: '#C43C3C',
  black: '#000000'
} as const;

export const radius = {
  small: 6,
  medium: 16,
  large: 28,
  pill: 999
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30
} as const;

export const shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.18,
  shadowRadius: 8,
  elevation: 7
} as const;