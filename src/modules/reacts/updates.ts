import { Message, PartialMessage, ThreadChannel, ThreadOnlyChannel, User } from "discord.js";

import { getEXP, getLeaderboard, REACT_EXP_TYPE_PREFIX, setEXP } from "../levels/api";
import rates from "../levels/rates";
import * as levelsDB from "../levels/db";

import { ShowcasePostDB } from "./db";
import { getOrInitShowcasePost, HIGHLIGHT_THRESHOLD, highlightMessage, MONITORING_CHANNELS, unhighlightMessage } from "./api";


export async function msgReactsUpdate(msg: Message | PartialMessage) {
  // print("Checking msg: ", msg)
  // print("(msg.channel as ThreadChannel)?.parent?.isThreadOnly(): ", (msg.channel as ThreadChannel)?.parent?.isThreadOnly())
  
  if (
    (msg.channel as ThreadChannel)?.parent?.isThreadOnly() ?
      !MONITORING_CHANNELS.includes( (msg.channel as ThreadChannel).parentId ) :
      !MONITORING_CHANNELS.includes( msg.channelId )
  ) { return }
  
  const refetchedMsg = await msg.fetch(true)

  print("refetchedMsg: ", refetchedMsg)

  const raw_reacts = refetchedMsg.reactions.cache.toJSON()
  // print("raw_reacts: ", raw_reacts)

  let _user_collector: Set<User> = new Set()

  for (const react of raw_reacts) {
    // const react = await raw_react.fetch()
    const _user_coll = await react.users.fetch()
    
    for (const user of _user_coll.toJSON()) { _user_collector.add(user) }
  }

  const allUsers = Array.from(_user_collector)
  .filter(user => !user.bot && user.id != msg.author.id)

  const uniqueReactCount = allUsers.length

  const db = await ShowcasePostDB()

  const idx = await getOrInitShowcasePost(db, refetchedMsg)
  
  const thresholdMet = uniqueReactCount >= HIGHLIGHT_THRESHOLD

  const expValue = ((uniqueReactCount * rates.PER_REACT) * (db.data[idx].for_post_day ? 2 : 1))
  setEXP(refetchedMsg.author.id, `${REACT_EXP_TYPE_PREFIX}${refetchedMsg.id}`, expValue, {timeRange: [msg.createdTimestamp, msg.createdTimestamp]})

  db.data[idx].reacts = uniqueReactCount
  if (uniqueReactCount > 0) { await db.write() }

  if (thresholdMet) {
    await highlightMessage(db, idx)
  } else if (db.data[idx].forward_id != undefined) {
    await unhighlightMessage(db, idx)
  }

  if (uniqueReactCount == 0) {
    db.data.splice(idx, 1)
    await db.write()
  }

  print("reactsDB: ", db.data)
  print("levels: ", levelsDB)
  print("NEW EXP: ", (await getEXP(msg.author.id)))
  print("Leaderboard: ", (await getLeaderboard()))
}