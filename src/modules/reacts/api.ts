import { ForumChannel, Message, MessageCreateOptions, MessageEditOptions, PartialMessage, TextChannel, ThreadChannel } from "discord.js"
import { Low } from "lowdb/lib"

import { client } from "../client"

import { ShowcasePostData, ShowcasePostDataEntry, ShowcasePostDB } from "./db"
import { colord } from "colord"


export const HIGHLIGHT_THRESHOLD = 10

export const MONITORING_CHANNELS = [
  process.env.SHOWCASE_CHANNEL_ID,
  process.env.WIPS_CHANNEL_ID,
  process.env.PROJECTS_CHANNEL_ID,
  process.env.POST_DAY_CHANNEL_ID
]


export async function getOrInitShowcasePost(db: Low<ShowcasePostData>, msg: Message) {
  const idx = db.data.findIndex(entry => entry.post_id == msg.id)

  if (idx != -1) {
    return idx
  }

  const futureIdx = db.data.length

  const newEntry: ShowcasePostDataEntry = {
    post_id: msg.id,
    post_timestamp: msg.createdTimestamp,
    author_id: msg.author.id,
    channel_id: msg.channelId,
    watched_channel_id: (msg.channel as ThreadChannel)?.parent?.isThreadOnly() ?
      (msg.channel as ThreadChannel).parentId :
      msg.channelId,
    reply_thread_url: msg?.thread?.url ?? (msg.channel as ThreadChannel)?.url,
    reacts: 0,
    forward_id: undefined,
    footer_id: undefined,
    for_post_day: (msg.channelId == process.env.POST_DAY_CHANNEL_ID)
  }

  db.data.push(newEntry)
  
  await db.write()

  return futureIdx
}

export async function highlightMessage(db: Low<ShowcasePostData>, idx: number) {
  if (db.data[idx] == undefined) { return }

  await forwardPost(db, idx)
  await doForwardFooter(db, idx)
}

export async function forwardPost(db: Low<ShowcasePostData>, idx: number) {
  if (db.data[idx].forward_id != undefined) { return }

  const msgChannel = (await client.channels.fetch(db.data[idx].channel_id)) as TextChannel
  const msg = await msgChannel.messages.fetch(db.data[idx].post_id)
  
  const forwardMsg = await msg.forward(process.env.HIGHLIGHTS_CHANNEL_ID)
  db.data[idx].forward_id = forwardMsg.id
  await db.write()
}

export async function doForwardFooter(db: Low<ShowcasePostData>, idx: number) {
  if (db.data[idx].forward_id == undefined) { await forwardPost(db, idx) }
  
  const highlightsChannel = (await client.channels.fetch(process.env.HIGHLIGHTS_CHANNEL_ID)) as TextChannel
  const forwardMsg = await highlightsChannel.messages.fetch(db.data[idx].forward_id)
  
  const postChannel = (await client.channels.fetch(db.data[idx].watched_channel_id)) as TextChannel | ForumChannel
  const ID_TO_LABEL = {
    [process.env.WIPS_CHANNEL_ID]: "WORK-IN-PROGRESS",
    [process.env.SHOWCASE_CHANNEL_ID]: "SHOWCASE",
    [process.env.PROJECTS_CHANNEL_ID]: "PROJECTS",
    [process.env.POST_DAY_CHANNEL_ID]: "POST-DAY",
  }
  // db.data[idx].thread_id
  // const post = await ((postChannel as TextChannel).messages ?? (postChannel as TextChannel).).fetch(db.data[idx].post_id)

  const updating = db.data[idx].footer_id != undefined

  // const author = client.mem.fetch(db.data[idx].author_id)
  const guild = await client.guilds.fetch(process.env.GUILD_ID)
  const authorMember = await guild.members.fetch(db.data[idx].author_id)

  const COLOR_TIERS = ["#f4900c", "#0688fc", "#F200FF"]
  const tier = Math.min(Math.floor(db.data[idx].reacts / HIGHLIGHT_THRESHOLD) - 1, COLOR_TIERS.length-1)
  const tierProgress = (db.data[idx].reacts / HIGHLIGHT_THRESHOLD) % 1.0

  const currTierColor = colord(COLOR_TIERS[tier])
  const nextTierColor = colord(COLOR_TIERS[tier+1])
  const mixedTierColor = currTierColor.mix(nextTierColor, tierProgress)
  const mixedTierColorNum = Number("0x" + mixedTierColor.toHex().replace("#", ""))


  const footerOptions: MessageCreateOptions | MessageEditOptions = {
    embeds: [
      {
        "description": `# <@${db.data[idx].author_id}>\n## **\`\`${db.data[idx].reacts}\`\`** -⠀🔥 Reacts${"!".repeat(tier+1)}`,
        "color": mixedTierColorNum,
        "thumbnail": {
          "url": (authorMember.avatarURL({size: 256}) ?? authorMember.user.avatarURL({size: 256}))
        },
        "fields": [
          {
            "name": "💬 Reply Thread",
            "value": `${db.data[idx].reply_thread_url}`,
            "inline": false
          },
          {
            "name": " ",
            "value": `[\`\`${ID_TO_LABEL[db.data[idx].watched_channel_id]}\`\`](${postChannel.url})`
          }
        ]
      }
      // {
      //   description: `# <@${db.data[idx].author_id}>: ${db.data[idx].reacts} UNIQUE REACTS${"!".repeat(tier+1)}`,
      //   color: mixedTierColorNum,
      //   thumbnail: {
      //     url: (authorMember.avatarURL({size: 256}) ?? authorMember.user.avatarURL({size: 256})),
      //     width: 256,
      //     height: 256
      //   }
      // }
    ]
  }

  if (!updating) {
    // const forwardMsg = await highlightsChannel.messages.fetch(db.data[idx].forward_id)
    const footerMsg = await highlightsChannel.send(footerOptions as MessageCreateOptions)
    
    db.data[idx].footer_id = footerMsg.id
    await db.write()
  } else {
    const footerMsg = await highlightsChannel.messages.fetch(db.data[idx].footer_id)
    await footerMsg.edit(footerOptions as MessageEditOptions)
  }
}

export async function unhighlightMessage(db: Low<ShowcasePostData>, msgId: string)
export async function unhighlightMessage(db: Low<ShowcasePostData>, idx: number)
export async function unhighlightMessage(db: Low<ShowcasePostData>, msgId_or_idx: string | number) {
  let idx: number = ((typeof(msgId_or_idx) == "number") ? msgId_or_idx : db.data.findIndex(entry => entry.post_id == msgId_or_idx))
  if (idx == -1) { return }

  if (db.data[idx] == undefined) { return }

  const props = [
    "forward_id",
    "footer_id"
  ]

  if (props.every(prop => db.data[idx][prop] == undefined)) { return }

  const highlightsChannel = (await client.channels.fetch(process.env.HIGHLIGHTS_CHANNEL_ID)) as TextChannel
  
  for (const prop of props) {
    if (db.data[idx][prop] == undefined) { continue } 

    await highlightsChannel.messages.delete(db.data[idx][prop])
    db.data[idx][prop] = undefined
  }

  await db.write()
}


export async function getTotalReactCount(member_id: string) {
  const post_db = await ShowcasePostDB()
  const member_posts = post_db.data.filter(entry => entry.author_id == member_id)
  const totalReactCount = member_posts.reduce((prev, curr) => prev + curr.reacts, 0)

  return totalReactCount
}