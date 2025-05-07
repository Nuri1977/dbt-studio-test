import Analytics from 'electron-google-analytics4';
import { app, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { machineIdSync } from 'node-machine-id';
import path from 'path';

// Your Google Analytics Property ID and Secret Key
const MEASUREMENT_ID = 'G-VBXMX54ELS';
const SECRET_KEY = 'dlitu4BzSCq3EIgyxphkpQ';

export default class AnalyticsService {
  private static analytics: Analytics;
  private static clientID: string;
  private static sessionID: string;
  private static debugMode: boolean;

  private static initialize() {
    if (!this.analytics) {
      this.clientID = this.getClientID();
      this.sessionID = uuidv4();
      this.debugMode = process.env.NODE_ENV === 'development';

      this.analytics = new Analytics(MEASUREMENT_ID, SECRET_KEY, this.clientID, this.sessionID);

      if (this.debugMode) {
        this.setParams({
          debug_mode: true,
          app_version: app.getVersion(),
          os_platform: process.platform,
          os_release: process.getSystemVersion()
        });
      }

      this.setUserProperties({
        app_version: app.getVersion(),
        os_platform: process.platform
      });
    }
    return this.analytics;
  }

  private static getClientID(): string {
    try {
      // Use machine ID as the client ID for consistent tracking across sessions
      return machineIdSync(true);
    } catch (error: any) {
      return uuidv4();
    }
  }

  static setParams(params: Record<string, any> = {}): void {
    const analytics = this.initialize();
    analytics.setParams(params);
  }

  static setUserProperties(properties: Record<string, any> = {}): void {
    const analytics = this.initialize();
    analytics.setUserProperties(properties);
  }

  static async trackEvent(
    category: string,
    action: string,
    options: { evLabel?: string; evValue?: number } = {}
  ): Promise<void> {
    try {
      const analytics = this.initialize();
      const eventName = `${category}_${action}`.toLowerCase().replace(/\s+/g, '_');

      const params: Record<string, any> = {
        event_timestamp: new Date().toISOString()
      };

      if (options.evLabel) {
        params.event_label = options.evLabel;
      }

      if (options.evValue !== undefined) {
        params.event_value = options.evValue;
      }

      this.setParams(params);
      await analytics.event(eventName);
      this.sendEventToRenderer(category, action, options.evLabel, options.evValue);
    } catch (err: any) {
      // Silently fail but still throw for UI handling
      throw err;
    }
  }

  static async trackException(description: string, fatal: number = 0): Promise<void> {
    try {
      const analytics = this.initialize();
      this.setParams({
        exception_description: description,
        is_fatal: fatal === 1,
        timestamp: new Date().toISOString()
      });

      await analytics.event('exception');
      this.sendExceptionToRenderer(description, fatal === 1);
    } catch (err: any) {
      // Silently fail
    }
  }

  static async trackScreen(screenName: string): Promise<void> {
    try {
      const analytics = this.initialize();
      const appName = 'Rosetta_dbt_Studio';

      this.setParams({
        screen_name: screenName,
        app_name: appName,
        app_version: app.getVersion(),
        timestamp: new Date().toISOString()
      });

      await analytics.event('screen_view');
      this.sendPageViewToRenderer(`/screens/${screenName.toLowerCase()}`, screenName);
    } catch (err: any) {
      // Silently fail
    }
  }

  static async trackPageView(hostname: string, url: string, title: string): Promise<void> {
    try {
      const analytics = this.initialize();
      this.setParams({
        page_location: url,
        page_title: title,
        hostname: hostname,
        timestamp: new Date().toISOString()
      });

      await analytics.event('page_view');
      this.sendPageViewToRenderer(url, title);
    } catch (err: any) {
      // Silently fail
    }
  }

  private static sendEventToRenderer(category: string, action: string, label?: string, value?: number): void {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.executeJavaScript(
          `window.electron.analytics.trackEvent("${category}", "${action}", ${label ? `"${label}"` : 'undefined'}, ${value !== undefined ? value : 'undefined'})`
        );
      }
    } catch (err) {
      // Silently fail
    }
  }

  private static sendExceptionToRenderer(description: string, fatal: boolean): void {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.executeJavaScript(
          `window.electron.analytics.trackException("${description.replace(/"/g, '\\"')}", ${fatal})`
        );
      }
    } catch (err) {
      // Silently fail
    }
  }

  private static sendPageViewToRenderer(path: string, title: string): void {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.executeJavaScript(
          `window.electron.analytics.trackPageView("${path.replace(/"/g, '\\"')}", "${title.replace(/"/g, '\\"')}")`
        );
      }
    } catch (err) {
      // Silently fail
    }
  }
}

export const analyticsService = AnalyticsService;