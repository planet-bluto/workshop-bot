export interface IProcessEnv {
  TOKEN: string;
  USER_TOKEN: string;

  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  TWITCH_ACCESS_TOKEN: string;

  GUILD_ID: string;
  LIVE_CHANNEL_ID: string;

  HOSTNAME: string;
  SECRET: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends IProcessEnv { }
  }
}