export interface IProcessEnv {
  TOKEN: string;
  CLIENT_ID: string;
  USER_TOKEN: string;

  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  
  RAILWAY_VOLUME_MOUNT_PATH: string;
  CANVAS_DIR: string;

  GUILD_ID: string;
  LIVE_ROLE_ID: string;
  MOD_ROLE_ID: string;

  REPLY_THREAD_CHANNELS: string;

  BLUE_FIRE_EMOJI_ID: string;

  WIPS_CHANNEL_ID: string;
  SHOWCASE_CHANNEL_ID: string;
  PROJECTS_CHANNEL_ID: string;

  COWORKING_VOICE_ID: string;
  COWORKING_VOICE_CHANNELS: string;
  
  ANNOUNECMENT_DRAFT_CHANNEL_ID: string;
  ANNOUNCEMENT_CHANNEL_ID: string;
  HIGHLIGHTS_CHANNEL_ID: string;
  LIVE_CHANNEL_ID: string;
  STATUS_CHANNEL_ID: string;

  TIMEBLOCK_HEADER_ROLE: string;
  LEVELS_HEADER_ROLE: string;

  HOSTNAME: string;
  PORT: string;
  SECRET: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends IProcessEnv { }
  }
}