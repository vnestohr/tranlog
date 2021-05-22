const fs = require('fs');
const path = require('path');
const os = require('os');

const MsgType = {
    Error: "error",
    Warning: "warning",
    Status: "status",
    Info: "info",
    Debug: "debug",
    Diagnostic: "diagnostic"
};

// Dynamically create the msg type logging matrix json based on the given settings json.
function createTypeJson(typeSettings) {
    let typeJson = {};
    Object.keys(MsgType).forEach(type => {
        if (typeSettings != null && typeSettings.hasOwnProperty(type)) {
            typeJson[type]=(typeSettings[type]==true);
        }
        else {
            typeJson[type]=false;
        }
    });
    typeJson["Error"] = true;  // Always log errors.
    return typeJson;
}

// Extract an Tag's settings from the Tag definition json
function extractTag(name, opSettings) {
    let tagJson = {Name: name, Count:0};

    if (opSettings.hasOwnProperty("LogFileName")) {
        tagJson.LogFileName = opSettings.LogFileName;
    }

    if (opSettings.hasOwnProperty("Description")) {
        tagJson.Description = opSettings.Description;
    }

    if (opSettings.hasOwnProperty("MsgTypeSettings")) {
        tagJson.MsgTypes = createTypeJson(opSettings.MsgTypeSettings);
    }
    else {
        tagJson.MsgTypes = createTypeJson();
    }
    return tagJson;
}

// Transaction Log is the name of the package, the class is actually just LogFile.
class LogFile {

    // Create the logfile class and configure.
    constructor(settingsJson=null) {
        this.LogRoot = `${os.tmpdir}`;
        this.LogFileName = "logfile.log";
        this.DatePrefixLogfile = false;

        this.Tags = {
            default: {
                LogFileName: this.LogFileName,
                MsgTypes: createTypeJson()
            }
        };        

        if (settingsJson != null) {
            if (settingsJson.hasOwnProperty("LogRoot")) {
                this.LogRoot = settingsJson.LogRoot;
            }
            
            if (settingsJson.hasOwnProperty("LogFileName")) {
                this.LogRoot = settingsJson.LogFileName;
                this.Tags.default.LogFileName = settingsJson.LogFileName;
            }

            if (settingsJson.hasOwnProperty("DatePrefixLogfile")) {
                this.DatePrefixLogfile = (settingsJson.DatePrefixLogfile == true);
            }

            if (settingsJson.hasOwnProperty("Tags")) {
                Object.keys(settingsJson.Tags).forEach(tag => {
                    if (this.Tags.hasOwnProperty(tag)) {
                        console.log(`LogFile warning: Tag '${tag}' has multiple definitions in the settingsJson`);
                    }

                    this.Tags[tag] = extractTag(tag,settingsJson.Tags[tag]);
                });
            }
        }
    }

    // Adds a user defined 'tag' to the Tags that can be used to direct logging for a transaction/Tag.
    addTransaction(tag, description, msgsettings) {
        this.Tags[tag] = extractTag(tag,msgsettings);
        this.Tags[tag].Description = description;
    }

    // Gets a LogFile defined 'tag' for cases when the uniqueness needs to be made rather than already existing.
    getTransaction(description, msgsettings) {
        let tag = Date.getTime().toString();      // Should be unique enough...
        this.Tags[tag] = extractTag(tag,msgsettings);
        this.Tags[tag].Description = description;
        return tag;
    }

    // Ends a transaction: removes the record but will also log a 'end' line if there were any messages logged
    //  for the transaction.
    endTransaction(tag) {
        if (tag == "default") {
            return;  // 'default' must exist, do not allow it to be removed.
        }

        if (this.Tags.hasOwnProperty(tag)) {
            if (this.Tags[tag].Count > 0) {
                let logfile = calculateLogFile(this.Tags[tag]);
                this.writeToFile(logfile,`${tag}: End transaction.`);
            }
            delete this.Tags[tag];
        }
    }

    // Sets/changes the logging for a tag and message type.
    setLogging(tag,type,logging) {
        if (this.Tags.hasOwnProperty(tag) &&
            this.Tags[tag].hasOwnProperty(type)) {
            this.Tags[tag].MsgTypes[type] = (logging == true);
        }
    }

    audit(tag,type) {
        let auditstr = "";
        // Use the default record - if the Tag's record cannot be found.
        let oprec = this.Tags.default;
        if (this.Tags.hasOwnProperty(tag)) {
            oprec = this.Tags[tag];
            auditstr = `[Tag: ${tag}]`;
        }
        else {
            auditstr = `[Tag: Default]`;
        }

        if (!oprec.MsgTypes.hasOwnProperty(type)) {
            return "False " + auditstr + ` [${type} not defined]`;
        }
        else if (oprec.MsgTypes[type] != true) {
            return "False " + auditstr + ` [${type} set to false]`;
        }
        else {
            return "False " + auditstr + ` [${type} set to true]`;
        }
    }

    setLogfile(tag,filename) {
        if (this.Tags.hasOwnProperty(tag)) {
            this.Tags[tag].LogFileName = filename.split('\\').pop().split('/').pop();    // Just the filename, not any path elements.
        }            
    }

    getLogFiles(tags,type = null,count=false) {
        let logfiles = [];
        let tag_array = (tagstr == null) ? ["default"] : tags.split(',');
        let dateprefix = null;

        if (this.DatePrefixLogfile == true) {
            let now = new Date();
            dateprefix = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate()}`;
        }

        tag_array.forEach(tag => {
            let tagrec = this.Tags.hasOwnProperty(tag) ? this.Tags[tag] : this.Tags.default;
            if (type != null) {
                if (!tagrec.MsgTypes.hasOwnProperty(type) || !tagrec.MsgTypes[type]) {
                    // Message type not defined OR is set to false
                    continue;
                }
                else if (count) {
                    tagrec.Count++;
                }
            }

            let filename = tagrec.hasOwnProperty("LogFileName") ? tagrec.LogFileName : this.Tags.default.LogFileName;
            let path = (dateprefix != null) ? `${this.LogRoot}/${dateprefix}_${filename}` : `${this.LogRoot}/${filename}`;
            if (!logfiles.includes(path)) {
                logfiles.push(path)
            }
        });

        return logfiles;
    }

    // Write to the file.
    writeToFile(paths, line) {
        paths.forEach(path => {
            try {
                fs.appendFileSync(path,`${line}${os.EOL}`,{encoding:"utf-8"});
            }
            catch (error) {
                throw new Error(`LogFile(${path}) write error ${error.message}`);
            }
        });
    }


    // Based on console.log(...) but with a mandatory tag and type, which are used to determine if the
    //  message gets written to the log file or not.   This allows selective logging.
    log(tags, type, ...msgs) {
        if (tags == null || type == null || msgs.length == 0) {
            // Nothing given to log.
            return;
        }

        // A set of messages can be written to 0-n log files..
        let logfiles = getLogFiles(tags,type,true);

        let line = `${new Date().toISOString()} ${tag} (${type}):`;
        msgs.forEach(msg => {
            if (msg == null) {
                line += " null";
            }
            else if (typeof msg == 'string' || msg instanceof String) {
                line += msg;
            }
            else if (Array.isArray(msg)) {
                let arraystr = JSON.stringify(msg);
                if (arraystr.length + line.length > 120) {
                    this.writeToFile(logfiles,line);
                    line = "";
                    this.writeToFile(logfiles,arraystr);
                }
            }
            else if (msg.constructor == ({}).constructor) {
                let jsonstr = JSON.stringify(msg);
                if (jsonstr.length + line.length > 120) {
                    this.writeToFile(logfiles,line);
                    line = "";
                    this.writeToFile(logfiles,jsonstr);
                }
            }
            else if (msg instanceof Error) {
                line += ` ERROR(${msg.message})`;
            }
            else if (msg instanceof Date) {
                line += " " + msg.toISOString()
            }

            if (line.length > 120) {
                this.writeToFile(logfiles,line);
                line = "";
            }
        });

        if (line.length > 0) {
            this.writeToFile(logfiles,line);
        }
    }
}

module.exports = {LogFile,MsgType};