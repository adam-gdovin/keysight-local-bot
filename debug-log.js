const CHECK_MARK = "\x1b[32m✔\x1b[0m";
const CROSS = "\x1b[31m✘\x1b[0m";
const WARNING = "\x1b[33m⚠\x1b[0m";
const INFO = "\x1b[34m•\x1b[0m";

function success(...message){
    console.log(CHECK_MARK, ...message);
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
function line(length){
    console.log(`\x1b${"_".repeat(length)}\x1b[0m`)
}

module.exports = {success, warn, error, info, line};