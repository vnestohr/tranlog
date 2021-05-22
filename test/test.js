logfile = require("../src/tranlog");

const log = new tranlog.LogFile();

console.log("log",log);

console.log(log.audit("test","Test"));
console.log(log.audit("test","Error"));
console.log(log.audit("test","Warning"));

log.addTransaction("test","test tag", {MsgTypeSettings : {
    Error: false,
    Warning: true,
    Test: true
}});

console.log(log.audit("test","Test"));
console.log(log.audit("test","Error"));
console.log(log.audit("test","Warning"));