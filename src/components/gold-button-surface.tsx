import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// Shared warm button finish: peach edges with a soft, creamy center highlight.
export function GoldButtonSurface() {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, { borderRadius: 28, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`${id}-base`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0" stopColor="#E8B47F" />
            <Stop offset="0.5" stopColor="#F8D9B1" />
            <Stop offset="1" stopColor="#E8B47F" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}-base)`} />
      </Svg>
    </View>
  );
}
