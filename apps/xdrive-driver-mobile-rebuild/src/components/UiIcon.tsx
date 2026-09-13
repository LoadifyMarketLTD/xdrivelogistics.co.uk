import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type UiIconName = ComponentProps<typeof Ionicons>['name'];

export function UiIcon({ name, size = 20, color = '#111111', style }: {
  name: UiIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Ionicons
    accessible={false}
    importantForAccessibility="no"
    name={name}
    size={size}
    color={color}
    style={style}
  />;
}

UiIcon.glyphMap = Ionicons.glyphMap;
