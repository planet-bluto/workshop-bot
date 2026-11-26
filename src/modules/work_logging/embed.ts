import fs from 'node:fs';
import path from 'path';

import { createCanvas, Image, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { colord, extend } from "colord";
import mixPlugin from "colord/plugins/mix";
extend([mixPlugin]);
import { DateTime } from 'luxon';

// import { client } from "../client";
import { WEEKDAYS } from '../timeblocks/base';
import { calcSuperOrdinal, calcMyWeekDay, timestampFromSuperOrdinal } from './calc';
import { modulo } from '../../lib/modulo';
import { calcEXPinLevel, calcLevel, calcLevelProgress } from '../levels/api';
// export const calcMyWeekDay = (timestamp: number) => modulo((modulo(DateTime.fromMillis(timestamp).weekday, 7) - 1), 7);

export const WIDTH = 800

export const GAP = 8.5
export const PADDING = 10
export const LEFT_SIDE = 60
export const TOP_SIDE = 32

export const ROW_COUNT = 7
export const COL_COUNT = 20

export const CELL_COUNT = COL_COUNT * ROW_COUNT

export const CELL_SIZE = (WIDTH - ((GAP * (COL_COUNT - 1)) + (PADDING * 2) + LEFT_SIDE)) / COL_COUNT

export const HEIGHT = Math.ceil((ROW_COUNT * CELL_SIZE) + (PADDING * 2) + (GAP * (ROW_COUNT - 1)) + TOP_SIDE)

export const PROGRESS_BAR_HEIGHT = 32
const PROGRESS_BAR_Y_MARGIN = 48
const PROGRESS_BAR_X = PADDING
const PROGRESS_BAR_Y = HEIGHT + PROGRESS_BAR_Y_MARGIN
const PROGRESS_BAR_WIDTH = WIDTH - PROGRESS_BAR_X - PADDING

export const WHOLE_HEIGHT = HEIGHT + PROGRESS_BAR_Y_MARGIN + PROGRESS_BAR_HEIGHT + PADDING


// client.on("messageCreate", (msg) => {if (msg.content == "!gridtest") { createEmbedImage() }})

GlobalFonts.registerFromPath(path.join(process.env.CANVAS_DIR, 'fonts', 'NunitoSans.ttf'), 'NunitoSans')


export async function createEmbedImage(heatmapData: {startDay: number; data: number[]}, EXP: number): Promise<{width: number; height: number; buffer: Buffer} | undefined> {
  const LVL = calcLevel(EXP)
  const LVLprog = calcLevelProgress(EXP)

  print("heatmapData: ", heatmapData)
  // print("WIDTH: ", WIDTH)
  // print("HEIGHT: ", HEIGHT)
  // print("CELL_SIZE: ", CELL_SIZE)

  const usableData = heatmapData.data.slice(-CELL_COUNT)
  const dataToMap = Array.from(new Array(COL_COUNT * ROW_COUNT))
    .map(() => 0.0)    
  
  dataToMap.splice(CELL_COUNT - usableData.length - (6 - calcMyWeekDay(heatmapData.startDay)), usableData.length, ...usableData)

  // print("dataToMap: ", dataToMap)
  
  const firstVisibleOrdinal = calcSuperOrdinal(heatmapData.startDay) + (6 - calcMyWeekDay(heatmapData.startDay)) - CELL_COUNT
  // print("firstVisibleOrdinal: ", firstVisibleOrdinal)
  const dtFromIdx = i => DateTime.fromMillis(timestampFromSuperOrdinal(firstVisibleOrdinal + i))

  const canvas = createCanvas(WIDTH, WHOLE_HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = "#024aca"

  let cellImg: Image
  try {
    cellImg = await loadImage(path.join(process.env.CANVAS_DIR, 'img', 'cell.png'))
  } catch(err) {
    print("oops: ", err)
    return undefined
  }

  for (let x = 0; x < COL_COUNT; x++) {
    for (let y = 0; y < ROW_COUNT; y++) {
      ctx.drawImage(
        cellImg,
        LEFT_SIDE + PADDING + (x * GAP) + (x * CELL_SIZE),
        TOP_SIDE + PADDING + (y * GAP) + (y * CELL_SIZE),
        CELL_SIZE,
        CELL_SIZE
      )
    }
  }

  const cells = await loadImage(canvas.toBuffer("image/png"))
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  
  // ctx.globalCompositeOperation ='source-in'
  
  // print("(COL_COUNT * ROW_COUNT): ", (COL_COUNT * ROW_COUNT))

  for (let y = 0; y < ROW_COUNT; y++) {
    for (let x = 0; x < COL_COUNT; x++) {
      var i = (x * ROW_COUNT) + y
      // var mult = i / (COL_COUNT * ROW_COUNT)
      // print(`(${x}, ${y}): ${i} (${mult})`)

      // const dt = dtFromIdx(i)
      const idxSuperOrd = firstVisibleOrdinal + i
      const nowSuperOrd = calcSuperOrdinal(DateTime.now().toMillis())

      // print(`${idxSuperOrd} > ${nowSuperOrd}`)

      ctx.fillStyle = 
        (idxSuperOrd + 1) > nowSuperOrd ?
          "#00000000" :
          dataToMap[i] == 0 ?
            "#2828287c" :
            colord("#282828").mix(colord("#2765ff"), dataToMap[i], "rgb").toHex()
      
      ctx.fillRect(
        LEFT_SIDE + PADDING + (x * GAP) + (x * CELL_SIZE),
        TOP_SIDE + PADDING + (y * GAP) + (y * CELL_SIZE),
        CELL_SIZE,
        CELL_SIZE
      )
    }
  }

  const fills = await loadImage(canvas.toBuffer("image/png"))
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  
  ctx.drawImage(cells, 0, 0)
  ctx.globalCompositeOperation = "source-in"
  ctx.drawImage(fills, 0, 0)
  
  const squares = await loadImage(canvas.toBuffer("image/png"))
  ctx.reset()
  ctx.fillStyle = "#1515159c"
  ctx.fillRect(0, 0, WIDTH, WHOLE_HEIGHT)
  ctx.drawImage(squares, 0, 0)

  for (const weekday of WEEKDAYS) {
    const y = WEEKDAYS.indexOf(weekday)
    ctx.fillStyle = "#ffffff33"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.font = "700 32px NunitoSans";
    ctx.fillText(
        `${weekday[0]}${weekday[1].toLowerCase()}`,
        PADDING,
        TOP_SIDE + PADDING + (y * GAP) + (y * CELL_SIZE)
    )
  }

  for (let i = CELL_COUNT - 1; i > -1; i--) {
    // print("i: ", i)
    const x = Math.floor(i / ROW_COUNT)
    // const y = i - (Math.floor(i / ROW_COUNT) * ROW_COUNT)

    const dt = dtFromIdx(i)

    if (dt.day == 1) {
      ctx.font = "1000 24px NunitoSans";
      ctx.textAlign = "center"
      ctx.fillText(
          `${dt.monthShort.toUpperCase()}`,
          LEFT_SIDE + PADDING + (x * GAP) + (x * CELL_SIZE) + (CELL_SIZE / 2),
          PADDING
      )
    }
  }

  ctx.font = "900 24px NunitoSans";
  ctx.textAlign = "left"
  ctx.fillText(
      `LVL ${LVL} (${(LVLprog * 100).toFixed(2)}%)`,
      PROGRESS_BAR_X,
      PROGRESS_BAR_Y - 28
  )

  ctx.fillStyle = "#ffffff20"
  ctx.font = "900 24px NunitoSans";
  ctx.textAlign = "right"
  ctx.fillText(
      `[ ${EXP.toFixed(2)}WP / ${calcEXPinLevel(LVL+1).toFixed(2)}WP ]`,
      PROGRESS_BAR_X + PROGRESS_BAR_WIDTH,
      PROGRESS_BAR_Y - 28
  )

  ctx.fillStyle = "#282828"
  ctx.fillRect(
    PROGRESS_BAR_X,
    PROGRESS_BAR_Y,
    PROGRESS_BAR_WIDTH,
    PROGRESS_BAR_HEIGHT
  )

  print("LVLprog: ", LVLprog)

  ctx.fillStyle = "#2765ff"
  ctx.fillRect(
    PROGRESS_BAR_X,
    PROGRESS_BAR_Y,
    PROGRESS_BAR_WIDTH * LVLprog,
    PROGRESS_BAR_HEIGHT
  )

  return {
    width: WIDTH,
    height: WHOLE_HEIGHT,
    buffer: canvas.toBuffer("image/png")
  }
}

createEmbedImage({
  startDay: DateTime.now().startOf('day').toMillis(),
  data: [0.1, 0.25, 0.5, 1.0]
}, 230).then(grid => {if (grid) {fs.writeFile("out.png", grid.buffer, () => {})}})