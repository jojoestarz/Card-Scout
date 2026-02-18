// DotBackground.tsx
import React from 'react';
import { useColorScheme, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Circle } from 'react-native-svg';


type Props = {
  dotSpacing?: number;   // distance between dots
  dotRadius?: number;    // dot size
};

const DotBackground: React.FC<Props> = ({
  dotSpacing = 30,
  dotRadius = 1,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const colors = isDark
    ? {
        base: '#111111',  // dark base
        dot: '#6b3fa0',   // subtle grey dots 
    // No change needed - the dark mode dot color is already set correctly
      }
    : {
        base: '#f7f5f2',  // light cream (like your Figma)
        dot: '#d1d1d1',   // same as radial-gradient color
      };

  return (
    <Svg style={styles.svg} width="100%" height="100%">
      <Defs>
        <Pattern
          id="dotPattern"
          x="0"
          y="0"
          width={dotSpacing}
          height={dotSpacing}
          patternUnits="userSpaceOnUse"
        >
          <Circle
            cx={dotSpacing / 2}
            cy={dotSpacing / 2}
            r={dotRadius}
            fill={colors.dot}
          />
        </Pattern>
      </Defs>

      {/* base background color */}
      <Rect x="0" y="0" width="100%" height="100%" fill={colors.base} />

      {/* dotted overlay */}
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="url(#dotPattern)"
      />
    </Svg>
  );
};

const styles = StyleSheet.create({
  svg: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default DotBackground;
