import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: '{{mobile_passwords_package}}',
  appName: 'passwords',
  webDir: '../frontend/dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  android: {
    backgroundColor: '#050505',
    includePlugins: [],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#050505',
    },
  },
}

export default config