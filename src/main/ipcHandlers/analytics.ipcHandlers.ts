import { ipcMain } from 'electron';
import { AnalyticsService } from '../services';

const registerAnalyticsHandlers = () => {
  // Regular analytics events
  ipcMain.handle('analytics:event', async (_, { category, action, options }) => {
    try {
      const result = await AnalyticsService.trackEvent(category, action, options);
      return { success: true, result };
    } catch (error: any) {
      console.error('Failed to track event:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:screen', async (_, { screenName }) => {
    try {
      await AnalyticsService.trackScreen(screenName);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to track screen view:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:pageview', async (_, { path, title }) => {
    try {
      await AnalyticsService.trackPageView('app', path, title);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to track page view:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:exception', async (_, { description, fatal }) => {
    try {
      await AnalyticsService.trackException(description, fatal);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to track exception:', error);
      return { success: false, error: error.message };
    }
  });

  // Debug handlers
  ipcMain.handle('analytics:test-event', async (_, eventData: { category: string; action: string; label?: string }) => {
    try {
      await AnalyticsService.trackEvent(eventData.category, eventData.action, { evLabel: eventData.label });
      return { success: true, message: `Event tracked: ${eventData.category} - ${eventData.action}` };
    } catch (error: any) {
      return { success: false, message: `Failed to track event: ${error.message}` };
    }
  });

  ipcMain.handle('analytics:get-status', async () => {
    try {
      return {
        success: true,
        enabled: true,
        lastEvent: AnalyticsService.getLastEvent() || null,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });
};

export default registerAnalyticsHandlers;