import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nomadicphone.app',
  appName: 'Nomadic Phone',
  webDir: 'build',
  server: {
    // Point to wherever you host your app
    url: 'https://app-nomadic-phone.t1irgo.easypanel.host',

    // Or for local testing:
    // url: 'http://192.168.0.102:3000',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2c5aa0',
      showSpinner: true,
      spinnerColor: '#ffffff'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2c5aa0',
      overlaysWebView: false
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
