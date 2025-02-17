const WHITE = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[36m"

const CROSS = `${RED}✘${WHITE}`;
const CHECKMARK = `${GREEN}✔${WHITE}`;
const WARNING = `${YELLOW}⚠${WHITE}`;
const INFO = `${BLUE}•${WHITE}`;


function success(...message) {
    console.log(CHECKMARK, ...message);
}
function warn(...message) {
    console.log(WARNING, ...message);
}
function error(...message) {
    console.log(CROSS, ...message);
}
function info(...message) {
    console.log(INFO, ...message);
}
function line(length) {
    console.log(`\x1b[33m${"_".repeat(length)}\x1b[0m`)
}

module.exports = { success, warn, error, info, line , WHITE, RED, GREEN, YELLOW, BLUE };