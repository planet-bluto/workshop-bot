import EventEmitter from 'eventemitter3';
import express from 'express';
import { createServer } from 'http';

export const ExpressEvents = new EventEmitter()

export const app = express()
const httpServer = createServer(app)

// app.use(express.json())
app.get("/", (req, res) => {
  res.send("Hello!")
})

ExpressEvents.emit("middlewareInit", app)

httpServer.listen(process.env["PORT"], async () => {
  print(`Web Server Listening... (${process.env["PORT"]})`)
  ExpressEvents.emit("middlewareSetup")
})