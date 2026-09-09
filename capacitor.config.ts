import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hichord.app',
  appName: 'HiChord',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    ScreenOrientation: {
      landscape: true,
    },
    KeepAwake: {},
  },
};

export default config;
