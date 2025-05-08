import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { machineIdSync } from 'node-machine-id';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || ''
const GA_API_SECRET = process.env.GA_API_SECRET || '';

// GA4 requires specific parameter formats
const GA4_PARAMETER_NAMES = {
  // Standard parameters
  CLIENT_ID: 'client_id',
  USER_ID: 'user_id',
  TIMESTAMP_MICROS: 'timestamp_micros',
  NON_PERSONALIZED_ADS: 'non_personalized_ads',

  // User properties
  USER_PROPERTIES: 'user_properties',

  // Session parameters
  SESSION_ID: 'session_id',
  ENGAGEMENT_TIME_MSEC: 'engagement_time_msec',

  // Page/screen parameters
  PAGE_LOCATION: 'page_location',
  PAGE_TITLE: 'page_title',
  PAGE_REFERRER: 'page_referrer',
  SCREEN_RESOLUTION: 'screen_resolution',

  // Event parameters
  EVENTS: 'events',
  NAME: 'name',
  PARAMS: 'params',

  // App info parameters
  APP_NAME: 'app_name',
  APP_VERSION: 'app_version',
  APP_INSTANCE_ID: 'app_instance_id',

  // Device parameters
  DEVICE_CATEGORY: 'device_category',
  PLATFORM: 'platform',
  OS: 'operating_system',
  OS_VERSION: 'operating_system_version',

  // Location parameters
  COUNTRY: 'country',
  REGION: 'region',
  CITY: 'city',
  LOCALE: 'locale',
};

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  timestamp: string;
  response?: {
    status?: number;
    statusText?: string;
    clientId: string;
    sessionId: string;
    serverResponse: any;
    responseHeaders: any;
  };
  error?: {
    message: string;
    code?: string;
    response?: any;
    status?: number;
    statusText?: string;
  };
}

export default class AnalyticsService {
  private static clientId: string;
  private static sessionId: string;
  private static debugMode: boolean;
  private static lastEvent: AnalyticsEvent | null = null;
  private static readonly clientIdPath: string = path.join(
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(process.env.HOME!, 'Library', 'Application Support')
      : path.join(process.env.HOME!, '.config')),
    'rosetta-dbt-studio-client-id.txt'
  );
  private static userProperties: Record<string, any> = {};
  private static initialized = false;
  private static sessionStartTime: number = Date.now();

  static {
    this.debugMode = process.env.NODE_ENV === 'development';
    this.sessionId = uuidv4();
    this.clientId = this.loadOrCreateClientId();
    this.initialize();
  }

  private static initialize() {
    if (this.initialized) return;

    // Set default user properties
    this.userProperties = {
      app_version: {value: app.getVersion()},
      platform: {value: process.platform},
      os_version: {value: process.getSystemVersion()},
      locale: {value: app.getLocale()},
      screen_resolution: {value: this.getScreenResolution()},
      node_version: {value: process.versions.node},
      electron_version: {value: process.versions.electron},
      chrome_version: {value: process.versions.chrome},
      device_model: {value: this.getDeviceModel()},
      install_source: {value: app.getAppPath().includes('AppTranslocation') ? 'download' : 'installed'}
    };

    this.initialized = true;

    if (this.debugMode) {
      console.log('Analytics initialized with client ID:', this.clientId);
      console.log('User properties:', this.userProperties);
    }
  }

  private static getScreenResolution(): string {
    try {
      const primaryDisplay = require('electron').screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      return `${width}x${height}`;
    } catch (err) {
      return '1280x720'; // Fallback
    }
  }

  private static getDeviceModel(): string {
    try {
      return `${os.platform()}-${os.arch()}`;
    } catch (err) {
      return 'unknown';
    }
  }

  private static loadOrCreateClientId(): string {
    try {
      if (fs.existsSync(this.clientIdPath)) {
        return fs.readFileSync(this.clientIdPath, 'utf-8');
      }
      const id = machineIdSync(true);
      fs.writeFileSync(this.clientIdPath, id);
      return id;
    } catch (err) {
      console.error('Error handling analytics client ID:', err);
      return uuidv4(); // Fallback to non-persistent ID
    }
  }

  static setUserProperty(name: string, value: any) {
    this.userProperties[name] = {value};
  }

  private static async sendToGA4(eventName: string, params: Record<string, any> = {}) {
    if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
      console.warn('GA4 Measurement ID or API Secret not configured');
      return;
    }

    // Use production endpoint always - debug endpoint can be unreliable
    const baseUrl = 'https://www.google-analytics.com/mp/collect';
    const url = `${baseUrl}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

    // Calculate engagement time
    const now = Date.now();
    const engagementTime = now - this.sessionStartTime;
    this.sessionStartTime = now;

    // Convert timestamp to microseconds as a number
    const timestampMicros = now * 1000;

    // Structure event according to GA4 protocol
    const payload = {
      client_id: this.clientId,
      user_id: this.clientId,
      timestamp_micros: timestampMicros,
      non_personalized_ads: false,
      user_properties: this.userProperties,
      events: [{
        name: eventName,
        params: {
          ...params,
          engagement_time_msec: engagementTime,
          session_id: this.sessionId,
          // Required device & app parameters
          device_category: 'desktop',
          platform: process.platform,
          app_version: app.getVersion(),
          app_name: 'Rosetta_dbt_Studio',
          // Location data if available
          language: app.getLocale(),
          screen_resolution: this.getScreenResolution(),
          operating_system: process.platform,
          operating_system_version: process.getSystemVersion()
        }
      }]
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (this.debugMode) {
        // Log event details with sensitive data masked
        const sanitizedPayload = JSON.parse(JSON.stringify(payload));
        console.log(`Analytics event sent: ${eventName}`, {
          name: eventName,
          params: sanitizedPayload.events[0].params,
          status: response.status,
          validationMessages: response.data.validationMessages || []
        });
      }

      return response;
    } catch (error: any) {
      // Log error details without stack trace
      console.error('Analytics Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  static async trackEvent(
    category: string,
    action: string,
    options: { evLabel?: string; evValue?: number } = {}
  ): Promise<AnalyticsEvent> {
    try {
      const eventName = `${category}_${action}`.toLowerCase().replace(/\s+/g, '_');

      const params: Record<string, any> = {
        event_category: category,
        event_action: action,
        event_timestamp: new Date().toISOString()
      };

      if (options.evLabel) {
        params.event_label = options.evLabel;
      }

      if (options.evValue !== undefined) {
        params.event_value = options.evValue;
      }

      const response = await this.sendToGA4(eventName, params);

      this.lastEvent = {
        category,
        action,
        label: options.evLabel,
        timestamp: new Date().toISOString(),
        response: {
          status: response?.status,
          statusText: response?.statusText,
          clientId: this.clientId,
          sessionId: this.sessionId,
          serverResponse: response?.data,
          responseHeaders: response?.headers
        }
      };

      return this.lastEvent;
    } catch (err: any) {
      console.error('Analytics tracking failed:', err);
      this.lastEvent = {
        category,
        action,
        label: options.evLabel,
        timestamp: new Date().toISOString(),
        error: {
          message: err.message,
          code: err.code,
          response: err.response?.data,
          status: err.response?.status,
          statusText: err.response?.statusText
        }
      };
      throw err;
    }
  }

  static async trackException(description: string, fatal: boolean = false): Promise<void> {
    try {
      await this.sendToGA4('exception', {
        description,
        fatal,
        timestamp: new Date().toISOString()
      });
      this.sendExceptionToRenderer(description, fatal);
    } catch (err) {
      console.error('Failed to track exception:', err);
    }
  }

  static async trackScreen(screenName: string): Promise<void> {
    try {
      await this.sendToGA4('screen_view', {
        firebase_screen: screenName,  // Standard GA4 parameter
        firebase_screen_class: screenName,  // Standard GA4 parameter
        screen_name: screenName,
        page_title: screenName,
        page_location: `app://screens/${screenName.toLowerCase().replace(/\s+/g, '-')}`,
        // Additional recommended parameters for apps
        app_name: 'Rosetta_dbt_Studio',
        entrances: 1,
        engagement_time_msec: Date.now() - this.sessionStartTime
      });
    } catch (err) {
      console.error('Failed to track screen view:', err);
    }
  }

  static async trackPageView(hostname: string, url: string, title: string): Promise<void> {
    try {
      // Use standard GA4 page_view event with required parameters
      await this.sendToGA4('page_view', {
        [GA4_PARAMETER_NAMES.PAGE_LOCATION]: url,
        [GA4_PARAMETER_NAMES.PAGE_TITLE]: title,
        hostname: hostname,
      });
      this.sendPageViewToRenderer(url, title);
    } catch (err) {
      console.error('Failed to track page view:', err);
    }
  }

  static getLastEvent(): AnalyticsEvent | null {
    return this.lastEvent;
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
      console.error('Failed to send exception to renderer:', err);
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
      console.error('Failed to send page view to renderer:', err);
    }
  }
}

export const analyticsService = AnalyticsService;