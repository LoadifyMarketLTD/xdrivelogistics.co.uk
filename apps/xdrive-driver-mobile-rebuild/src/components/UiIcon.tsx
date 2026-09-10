import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from '../theme/primitives';

export const glyphMap = {
  'call': 0xead9,
  'car-outline': 0xeae3,
  'chatbubble-ellipses-outline': 0xeb14,
  'chevron-back': 0xeb2a,
  'chevron-forward': 0xeb3c,
  'cube-outline': 0xeb9a,
  'document-text-outline': 0xebb5,
  'ellipsis-horizontal-circle-outline': 0xebd1,
  'home-outline': 0xec84,
  'location': 0xecc5,
  'navigate-outline': 0xed71,
  'notifications-outline': 0xed80,
  'person-outline': 0xedad,
  'pricetag-outline': 0xedec,
  'receipt-outline': 0xee10,
  'search-outline': 0xee64,
  'time-outline': 0xeedf,
} as const;

export type UiIconName = keyof typeof glyphMap;
export function UiIcon({ name, size = 20, color = '#111111', style }: {
  name: UiIconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text
    accessible={false}
    importantForAccessibility="no"
    selectable={false}
    style={[{
      fontFamily: 'ionicons',
      fontSize: size,
      lineHeight: size + 2,
      color,
      includeFontPadding: false,
      textAlignVertical: 'center',
    }, style]}
  >{String.fromCodePoint(glyphMap[name])}</Text>;
}

UiIcon.glyphMap = glyphMap;
