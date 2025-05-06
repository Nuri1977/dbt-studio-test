declare module 'electron-google-analytics' {
  interface EventOptions {
    evLabel?: string;
    evValue?: number;
    clientID?: string;
    [key: string]: any;
  }

  export default class Analytics {
    constructor(trackingID: string);

    pageview(
      hostname: string,
      url: string,
      title: string,
      clientID?: string,
      params?: any
    ): Promise<any>;

    event(
      category: string,
      action: string,
      options?: EventOptions
    ): Promise<any>;

    screen(
      appName: string,
      appVersion: string,
      appID: string,
      installerID: string,
      screenName: string,
      clientID?: string,
      params?: any
    ): Promise<any>;

    exception(
      description: string,
      fatal?: number,
      clientID?: string,
      params?: any
    ): Promise<any>;
  }
}
