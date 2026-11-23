import fs from 'node:fs';
import path from 'path';

import { createCanvas, Image, loadImage } from "@napi-rs/canvas";
import { colord, extend } from "colord";
import mixPlugin from "colord/plugins/mix";
extend([mixPlugin]);
import { DateTime } from 'luxon';

// import { client } from "../client";
import { WEEKDAYS } from '../timeblocks/base';
import { calcSuperOrdinal, timestampFromSuperOrdinal } from './calc';
import { modulo } from '../../lib/modulo';
export const calcMyWeekDay = (timestamp: number) => modulo((modulo(DateTime.fromMillis(timestamp).weekday, 7) - 1), 7);

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


// client.on("messageCreate", (msg) => {if (msg.content == "!gridtest") { generateGrid() }})



export async function generateGrid(heatmapData: {startDay: number; data: number[]}): Promise<{width: number; height: number; buffer: Buffer} | undefined> {
  print("heatmapData: ", heatmapData)
  // print("WIDTH: ", WIDTH)
  // print("HEIGHT: ", HEIGHT)
  // print("CELL_SIZE: ", CELL_SIZE)

  const usableData = heatmapData.data.slice(-CELL_COUNT)
  const dataToMap = Array.from(new Array(COL_COUNT * ROW_COUNT))
    .map(() => 0.0)    
  
  dataToMap.splice(CELL_COUNT - usableData.length - (6 - calcMyWeekDay(heatmapData.startDay)), usableData.length, ...usableData)

  print("dataToMap: ", dataToMap)

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = "#024aca"

  let cellImg: Image
  try {
    cellImg = await loadImage(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'img', 'cell.png'))
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
  
  print("(COL_COUNT * ROW_COUNT): ", (COL_COUNT * ROW_COUNT))

  for (let y = 0; y < ROW_COUNT; y++) {
    for (let x = 0; x < COL_COUNT; x++) {
      var i = (x * ROW_COUNT) + y
      // var mult = i / (COL_COUNT * ROW_COUNT)
      // print(`(${x}, ${y}): ${i} (${mult})`)

      ctx.fillStyle = colord("#282828").mix(colord("#2765ff"), dataToMap[i], "rgb").toHex()
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
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.drawImage(squares, 0, 0)

  for (const weekday of WEEKDAYS) {
    const y = WEEKDAYS.indexOf(weekday)
    ctx.fillStyle = "#ffffff33"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.font = "700 32px sans";
    ctx.fillText(
        `${weekday[0]}${weekday[1].toLowerCase()}`,
        PADDING,
        TOP_SIDE + PADDING + (y * GAP) + (y * CELL_SIZE)
    )
  }


  const firstVisibleOrdinal = calcSuperOrdinal(heatmapData.startDay) + (6 - calcMyWeekDay(heatmapData.startDay)) - CELL_COUNT

  for (let i = CELL_COUNT - 1; i > -1; i--) {
    print("i: ", i)
    const x = Math.floor(i / ROW_COUNT)
    // const y = i - (Math.floor(i / ROW_COUNT) * ROW_COUNT)

    const dt = DateTime.fromMillis(timestampFromSuperOrdinal(firstVisibleOrdinal + i))

    if (dt.daysInMonth == dt.day) {
      ctx.font = "1000 24px sans";
      ctx.textAlign = "center"
      ctx.fillText(
          `${dt.monthShort.toUpperCase()}`,
          LEFT_SIDE + PADDING + (x * GAP) + (x * CELL_SIZE) + (CELL_SIZE / 2),
          PADDING
      )
    }
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    buffer: canvas.toBuffer("image/png")
  }
}

generateGrid({
  startDay: 3,
  data: [0.1, 0.25, 0.5, 1.0]
}).then(grid => {if (grid) {fs.writeFile("out.png", grid.buffer, () => {})}})