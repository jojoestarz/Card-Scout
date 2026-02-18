// theme.ts
import { useColorScheme } from 'react-native';

export const useThemeColors = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    text: isDark ? '#ffffff' : '#111111',
    textSecondary: isDark ? '#aaaaaa' : '#666666',
    card: isDark ? '#1e1e1e' : '#ffffff',
    border: isDark ? '#333333' : '#dddddd',
    accent: '#007AFF',
  };
};
