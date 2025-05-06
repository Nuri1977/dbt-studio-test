import Analytics from 'electron-google-analytics';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import electronLog from 'electron-log';

// Your Google Analytics Property ID
const TRACKING_ID = 'UA-488148515'; // Using UA- prefix as required by Google Analytics

class AnalyticsService {
  private analytics: Analytics;
  private clientID: string;

  constructor() {
    this.analytics = new Analytics(TRACKING_ID);
    // Generate or retrieve a persistent client ID
    this.clientID = this.getClientID();

    electronLog.info('Analytics service initialized with tracking ID: UA-488148515');
  }

  private getClientID(): string {
    // In a real app, you might want to store this in a persistent storage
    // For simplicity, we're generating a new UUID
    return uuidv4();
  }

  /**
   * Track a page view
   */
  async trackPageView(hostname: string, url: string, title: string): Promise<void> {
    try {
      await this.analytics.pageview(hostname, url, title, this.clientID);
      electronLog.debug(`Analytics pageview tracked: ${url}`);
    } catch (err) {
      electronLog.error('Analytics pageview error:', err);
    }
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
      await this.analytics.event(category, action, {
        ...options,
        clientID: this.clientID
      });
      electronLog.debug(`Analytics event tracked: ${category} - ${action}`);
    } catch (err) {
      electronLog.error('Analytics event error:', err);
    }
  }

  /**
   * Track an exception
   */
  async trackException(description: string, fatal: number = 0): Promise<void> {
    try {
      await this.analytics.exception(description, fatal, this.clientID);
      electronLog.debug(`Analytics exception tracked: ${description}`);
    } catch (err) {
      electronLog.error('Analytics exception error:', err);
    }
  }

  /**
   * Track screen view (useful for different app sections)
   */
  async trackScreen(screenName: string): Promise<void> {
    const appName = 'Rosetta_dbt_Studio';
    const appVersion = app.getVersion();
    const appID = 'org.rosettadb.dbtStudio';

    try {
      await this.analytics.screen(
        appName,
        appVersion,
        appID,
        '',  // installer ID
        screenName,
        this.clientID
      );
      electronLog.debug(`Analytics screen view tracked: ${screenName}`);
    } catch (err) {
      electronLog.error('Analytics screen view error:', err);
    }
  }
}

export const analyticsService = new AnalyticsService();