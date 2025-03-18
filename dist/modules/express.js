"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.ExpressEvents = void 0;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
exports.ExpressEvents = new eventemitter3_1.default();
exports.app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(exports.app);
// app.use(express.json())
exports.app.get("/", (req, res) => {
    res.send("Hello!");
});
exports.ExpressEvents.emit("middlewareInit", exports.app);
httpServer.listen(process.env["PORT"], () => __awaiter(void 0, void 0, void 0, function* () {
    print(`Web Server Listening... (${process.env["PORT"]})`);
    exports.ExpressEvents.emit("middlewareSetup");
}));
