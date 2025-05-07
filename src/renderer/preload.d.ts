import { ElectronHandler } from '../main/preload';

// Global declaration for Google Analytics gtag function
interface Window {
  dataLayer: any[];
  gtag: (...args: any[]) => void;
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export {};
