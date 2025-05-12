import { ipcMain } from 'electron';
import AnalyticsService from '../services/analytics.service';

const registerAnalyticsHandlers = () => {
  // Simplified handler that only returns the last tracked event (update event)
  ipcMain.handle('analytics:get-status', async () => {
    try {
      return {
        success: true,
        lastEvent: AnalyticsService.getLastEvent() || null,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });

  // Manually trigger app update tracking for testing or debugging
  ipcMain.handle('analytics:track-app-update', async () => {
    try {
      await AnalyticsService.trackAppUpdate();
      return {
        success: true,
        message: 'App update tracking completed',
        lastEvent: AnalyticsService.getLastEvent()
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });
};

export default registerAnalyticsHandlers;