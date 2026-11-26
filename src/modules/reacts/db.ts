import path from 'path'
import { JSONFilePreset } from 'lowdb/node'

export type ShowcasePostDataEntry = {
  post_id: string; // Showcase Post's ID
  post_timestamp: number; // Showcase Post's Created Unix Timestamp
  author_id: string; // Showcase Post's Author ID
  channel_id: string; // Showcase Post's Channel ID
  watched_channel_id: string; // Showcase Post's Channel ID
  reply_thread_url: string; // Post's Reply Thread (Link to thread or Projects Post)
  reacts: number; // Showcase Post's Unique Reaction Count
  forward_id: string | undefined; // Forwarded Message's ID
  footer_id: string | undefined; // Forwarded Message's Footer Message ID
}

export type ShowcasePostData = ShowcasePostDataEntry[]

export const ShowcasePostDB = async () => {
  const defaultData: ShowcasePostData = []
  return JSONFilePreset(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'db', 'showcase_post.json'), defaultData)
}