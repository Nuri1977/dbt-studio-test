import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Channels } from '../types/ipc';
import { version } from '../../package.json';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    removeListener(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.removeListener(channel, func);
    },
    invoke(channel: Channels, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, args[0]);
    },
  },
  app: {
    version,
    os: process.platform,
  },
  // Add analytics bridge
  analytics: {
    trackEvent(category: string, action: string, options: { evLabel?: string; evValue?: number } = {}) {
      return ipcRenderer.invoke('analytics:event', { category, action, options });
    },
    trackScreen(screenName: string) {
      return ipcRenderer.invoke('analytics:screen', { screenName });
    },
    trackPageView(path: string, title: string) {
      return ipcRenderer.invoke('analytics:pageview', { path, title });
    },
    trackException(description: string, fatal: boolean = false) {
      return ipcRenderer.invoke('analytics:exception', { description, fatal });
    },
    // Add new debug methods
    testEvent: (data: { category: string; action: string; label?: string }) =>
      ipcRenderer.invoke('analytics:test-event', data),
    getStatus: () => ipcRenderer.invoke('analytics:get-status'),
  }
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
