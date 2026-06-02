import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: '{{mobile_email_package}}',
  appName: 'email',
  webDir: '../frontend/dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  android: {
    backgroundColor: '#050505',
    includePlugins: [],
  },
}

export default config