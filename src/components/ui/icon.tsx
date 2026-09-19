import { type AndroidSymbol, type SFSymbol, SymbolView } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

export interface IconName {
  /** SF Symbol shown on iOS. */
  ios: SFSymbol;
  /** Material Symbol shown on Android and web. */
  material: AndroidSymbol;
}

interface IconProps {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
}

/** SF Symbols on iOS, Material Symbols elsewhere. */
export function Icon({ name, size = 20, color, style }: IconProps) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.material, web: name.material }}
      size={size}
      tintColor={color}
      weight="semibold"
      style={style}
    />
  );
}
