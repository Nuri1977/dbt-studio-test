import { ipcMain } from 'electron';
import { AnalyticsService } from '../services';

const registerAnalyticsHandlers = () => {
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
      // Add any relevant analytics status checks here
      return {
        success: true,
        enabled: true, // You might want to get this from your settings
        lastEvent: AnalyticsService.getLastEvent?.() || null,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });
};

export default registerAnalyticsHandlers;