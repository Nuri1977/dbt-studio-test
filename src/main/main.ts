/* eslint global-require: off, no-console: off, promise/always-return: off, no-restricted-syntax: off, no-await-in-loop: off */
import { app, protocol, session } from 'electron';
import { WindowManager } from './windows';
import { loadEnvironment } from './utils/setupHelpers';
import { AssetUrl } from './utils/assetUrl';
import { AssetServer } from './utils/assetServer';
import { setupApplicationIcon } from './utils/iconUtils';
import { SettingsService, AnalyticsService } from './services';
import { copyAssetsToUserData } from './utils/fileHelper';

const isProd = process.env.NODE_ENV === 'production';
const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

loadEnvironment(isDebug, isProd);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-asset',
    privileges: {
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

setupApplicationIcon();

// Ensure single instance of the app
const gotTheLock = app.requestSingleInstanceLock();
let windowManager: WindowManager | null = null;

if (!gotTheLock) {
  console.log('Another instance is already running. Quitting...');
  app.quit();
} else {
  app
    .whenReady()
    .then(() => {
      // Set up session for Google Analytics
      try {
        // Configure session to allow Google Analytics domains and log requests/responses
        session.defaultSession.webRequest.onBeforeSendHeaders(
          { urls: ['https://*.googletagmanager.com/*', 'https://*.google-analytics.com/*'] },
          (details, callback) => {
            console.log('GA Request:', {
              url: details.url,
              method: details.method,
              timestamp: new Date().toISOString()
            });
            callback({ requestHeaders: details.requestHeaders });
          }
        );

        // Add response logging
        session.defaultSession.webRequest.onCompleted(
          { urls: ['https://*.googletagmanager.com/*', 'https://*.google-analytics.com/*'] },
          (details) => {
            console.log('GA Response:', {
              url: details.url,
              statusCode: details.statusCode,
              statusLine: details.statusLine,
              timestamp: new Date().toISOString(),
              fromCache: details.fromCache
            });
          }
        );

        // Handle errors
        session.defaultSession.webRequest.onErrorOccurred(
          { urls: ['https://*.googletagmanager.com/*', 'https://*.google-analytics.com/*'] },
          (details) => {
            console.error('GA Error:', {
              url: details.url,
              error: details.error,
              timestamp: new Date().toISOString()
            });
          }
        );

        // Ensure cookies are persisted
        session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
          if (!removed &&
              (cookie.domain?.includes('google-analytics.com') ||
               cookie.domain?.includes('googletagmanager.com'))) {
            // Construct the URL from the cookie domain and path
            const protocol = cookie.secure ? 'https' : 'http';
            const url = `${protocol}://${cookie.domain}${cookie.path || '/'}`;

            // Make the cookie persistent
            session.defaultSession.cookies.set({
              url,
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              secure: cookie.secure,
              httpOnly: cookie.httpOnly,
              expirationDate: cookie.expirationDate || (Date.now() / 1000) + 31536000, // 1 year
              sameSite: cookie.sameSite
            });
          }
        });

        console.log('Google Analytics session handling configured');
      } catch (e) {
        console.error('Failed to configure Google Analytics session:', e);
      }

      // Track app launch event
      AnalyticsService.trackEvent('Application', 'Launch', {
        evLabel: `v${app.getVersion()}`
      });

      windowManager = new WindowManager();
      windowManager.startApplication();
      copyAssetsToUserData();
      const splash = windowManager.getSplash();

      if (splash) {
        splash.webContents.once('did-finish-load', async () => {
          // Track splash screen loaded
          AnalyticsService.trackScreen('SplashScreen');

          const updateMessage = async (msg: string) => {
            await splash.webContents.executeJavaScript(
              `window.updateLoaderMessage(${JSON.stringify(msg)})`,
            );
          };

          await updateMessage('Downloading latest Rosetta release...');
          try {
            await SettingsService.updateRosetta();
          } catch (e: any) {
            console.error(e);
            // Track error
            AnalyticsService.trackException(`Rosetta update error: ${e?.message}`, false);
          }

          await updateMessage('Embedding Python...');
          try {
            await SettingsService.updatePython();
          } catch (e:any) {
            console.error(e);
            // Track error
            AnalyticsService.trackException(`Python update error: ${e?.message}`, false);
          }

          const fakeStages = [
            { message: 'Loading settings...', delay: 1000 },
            { message: 'Loading projects...', delay: 1000 },
            { message: 'Getting everything ready...', delay: 1000 },
          ];

          for (const stage of fakeStages) {
            await updateMessage(stage.message);
            await new Promise((resolve) => {
              setTimeout(resolve, stage.delay);
            });
          }

          // Ensure windowManager is not null before using it
          if (windowManager) {
            // Wait for the main window to be fully ready before closing splash
            await windowManager.showMainWindow();
            windowManager.closeSplashScreen();
          }
        });
      }

      protocol.handle('app-asset', (request) => {
        const asset = new AssetUrl(request.url);
        return AssetServer.fromNodeModules(asset.relativeUrl);
      });

      // Enhanced macOS activate event handler - critical for dock icon clicks
      app.on('activate', () => {
        if (windowManager) {
          const mainWindow = windowManager.getMainWindow();

          if (mainWindow) {
            // Main window exists, show and focus it
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();

            // Track app activation
            AnalyticsService.trackEvent('Application', 'Activate');
          } else {
            // No windows exist, restart application
            windowManager.startApplication();
          }
        } else {
          // WindowManager doesn't exist, create one and start app
          windowManager = new WindowManager();
          windowManager.startApplication();
        }
      });
    })
    .catch((error) => {
      console.log(error);
      // Track startup error
      AnalyticsService.trackException(`App startup error: ${error.message}`, true);
    });

  // Handle second instance attempt - simplified
  app.on('second-instance', () => {
    if (!windowManager) return;

    // Find the active window to focus
    const activeWindow = windowManager.getMainWindow();

    if (activeWindow) {
      // Restore and focus the existing window
      if (activeWindow.isMinimized()) activeWindow.restore();
      activeWindow.show();
      activeWindow.focus();

      // Track second instance attempt
      AnalyticsService.trackEvent('Application', 'SecondInstance');
    } else {
      // No visible windows, start fresh
      windowManager.startApplication();
    }
  });
}

app.on('window-all-closed', () => {
  // Track all windows closed event
  AnalyticsService.trackEvent('Application', 'AllWindowsClosed');

  // Don't quit - WindowManager will handle the actual quitting
});

// Track app quit event
app.on('will-quit', () => {
  AnalyticsService.trackEvent('Application', 'Quit');
});
