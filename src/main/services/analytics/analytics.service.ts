import Analytics from 'electron-google-analytics4';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { machineIdSync } from 'node-machine-id';
import path from 'path';

// Your Google Analytics Property ID and Secret Key
const MEASUREMENT_ID = 'G-VBXMX54ELS';
const SECRET_KEY = 'dlitu4BzSCq3EIgyxphkpQ';

class AnalyticsService {
  private analytics: Analytics;
  private clientID: string;
  private sessionID: string;
  private debugMode: boolean;

  constructor() {
    this.clientID = this.getClientID();
    this.sessionID = uuidv4();
    this.debugMode = process.env.NODE_ENV === 'development';

    this.analytics = new Analytics(MEASUREMENT_ID, SECRET_KEY, this.clientID, this.sessionID);

    if (this.debugMode) {
      // Set up additional properties for debug environments
      this.setParams({
        debug_mode: true,
        app_version: app.getVersion(),
        os_platform: process.platform,
        os_release: process.getSystemVersion()
      });
    }

    // Set default user properties
    this.setUserProperties({
      app_version: app.getVersion(),
      os_platform: process.platform
    });
  }

  private getClientID(): string {
    try {
      // Use machine ID as the client ID for consistent tracking across sessions
      return machineIdSync(true);
    } catch (error: any) {
      return uuidv4();
    }
  }

  /**
   * Set a custom parameter
   */
  set(key: string, value: any): AnalyticsService {
    this.analytics.set(key, value);
    return this;
  }

  /**
   * Set multiple custom parameters
   */
  setParams(params: Record<string, any> = {}): AnalyticsService {
    this.analytics.setParams(params);
    return this;
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any> = {}): AnalyticsService {
    this.analytics.setUserProperties(properties);
    return this;
  }

  /**
   * Track an event
   */
  async trackEvent(
    category: string,
    action: string,
    options: { evLabel?: string; evValue?: number } = {}
  ): Promise<void> {
    try {
      // Set event properties based on category and action
      const eventName = `${category}_${action}`.toLowerCase().replace(/\s+/g, '_');

      if (options.evLabel) {
        this.set('event_label', options.evLabel);
      }

      if (options.evValue !== undefined) {
        this.set('event_value', options.evValue);
      }

      // Add timestamp for debug purposes
      this.set('event_timestamp', new Date().toISOString());

      // Send the event
      await this.analytics.event(eventName);
    } catch (err: any) {
      // Silently fail but still throw for UI handling
      throw err;
    }
  }

  /**
   * Track an exception
   */
  async trackException(description: string, fatal: number = 0): Promise<void> {
    try {
      this.setParams({
        exception_description: description,
        is_fatal: fatal === 1,
        timestamp: new Date().toISOString()
      });

      await this.analytics.event('exception');
    } catch (err: any) {
      // Silently fail
    }
  }

  /**
   * Track screen view (useful for different app sections)
   */
  async trackScreen(screenName: string): Promise<void> {
    try {
      const appName = 'Rosetta_dbt_Studio';
      const appVersion = app.getVersion();

      this.setParams({
        screen_name: screenName,
        app_name: appName,
        app_version: appVersion,
        timestamp: new Date().toISOString()
      });

      await this.analytics.event('screen_view');
    } catch (err: any) {
      // Silently fail
    }
  }

  /**
   * Track a page view
   */
  async trackPageView(hostname: string, url: string, title: string): Promise<void> {
    try {
      this.setParams({
        page_location: url,
        page_title: title,
        hostname: hostname,
        timestamp: new Date().toISOString()
      });

      await this.analytics.event('page_view');
    } catch (err: any) {
      // Silently fail
    }
  }
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;