"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = void 0;
const wait = (ms) => {
    return (new Promise((res, rej) => {
        setTimeout(() => {
            res();
        }, ms);
    }));
};
exports.wait = wait;
