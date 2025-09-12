import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export class StatusBarManager {
  private static initialized = false;

  /**
   * Initialize the status bar with proper configuration
   */
  static async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.initialized) {
      return;
    }

    try {
      // Set status bar to not overlay the webview
      await StatusBar.setOverlaysWebView({ overlay: false });
      
      // Set the status bar style to dark content (good for light backgrounds)
      await StatusBar.setStyle({ style: Style.Dark });
      
      // Set the background color to match your app's primary color
      await StatusBar.setBackgroundColor({ color: '#2c5aa0' });
      
      // Show the status bar
      await StatusBar.show();
      
      this.initialized = true;
      console.log('StatusBar initialized successfully');
    } catch (error) {
      console.error('Failed to initialize StatusBar:', error);
    }
  }

  /**
   * Set status bar style
   */
  static async setStyle(style: Style): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.setStyle({ style });
    } catch (error) {
      console.error('Failed to set StatusBar style:', error);
    }
  }

  /**
   * Set status bar background color
   */
  static async setBackgroundColor(color: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      console.error('Failed to set StatusBar background color:', error);
    }
  }

  /**
   * Show status bar
   */
  static async show(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.show();
    } catch (error) {
      console.error('Failed to show StatusBar:', error);
    }
  }

  /**
   * Hide status bar
   */
  static async hide(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.hide();
    } catch (error) {
      console.error('Failed to hide StatusBar:', error);
    }
  }

  /**
   * Get status bar info
   */
  static async getInfo(): Promise<any> {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      return await StatusBar.getInfo();
    } catch (error) {
      console.error('Failed to get StatusBar info:', error);
      return null;
    }
  }
}
