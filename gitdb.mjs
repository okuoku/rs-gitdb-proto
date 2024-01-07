import fs from "fs";
import path from "node:path";
import process from "node:process";
import child_process from "child_process";
import stream from "node:stream";

async function rungit_stdin(cmd, gitdir, env, buf){
    const myenv = {};
    for(const k in process.env){
        myenv[k] = process.env[k];
    }
    for(const k in env){
        myenv[k] = env[k];
    }

    const opt = {
        cwd: gitdir,
        env: myenv,
        stdio: ["pipe", "pipe", "inherit"]
    };

    let outbuf = "";
    const p = new Promise((res, rej) => {
        const child = child_process.spawn("git", cmd, opt);

        child.on("error", (e) => {
            rej(e);
        });

        child.stdout.setEncoding("utf8");

        // outbuf handler
        child.stdout.on("data", (e) => {
            outbuf += e;
        });
        child.stdout.on("close", () => {
            // Return buffer
            res(outbuf.trim());
        });

        // Write stdin
        child.stdin.end(buf);
    });

    const ret = await p;
    return ret;
}

async function rungit(cmd, gitdir, env){
    const myenv = {};
    for(const k in process.env){
        myenv[k] = process.env[k];
    }
    for(const k in env){
        myenv[k] = env[k];
    }

    const p = new Promise((res, rej) => {
        child_process.execFile("git", cmd,
                               {cwd: gitdir, env: myenv},
                               (err, stdout, stderr) => {
                                   if(! err){
                                       res(stdout.trim());
                                   }else{
                                       rej(err);
                                   }
                               });
    });

    const ret = await p;
    return ret;
}

function make_writer(gitdir, index_name){
    let currentref = "HEAD"; // FIXME: Resolve this into real ref
    let index_file = false;

    function procdate(obj){
        if(typeof obj == "string"){
            return obj;
        }else{
            return obj.toString();
        }
    }

    // Resolve index_name into an absolute path
    if(path.isAbsolute(index_name)){
        index_file = index_name;
    }else{
        index_file = process.cwd() + path.sep + index_name;
    }
    return {
        init: async function(ref){
            // git read-tree $ref
            if(ref){
                currentref = ref;
            }

            await rungit(["read-tree", currentref], gitdir,
                         {GIT_INDEX_FILE: index_file});
            return true;
        },
        set: async function(path, obj){
            // git hash-object -w --stdin < $obj > $hash
            // git update-index --add --cacheinfo 100644,$hash,$path
            const hash = await rungit_stdin(["hash-object", "-w", "--stdin"], 
                                            gitdir, {}, obj);
            const ci = "100644," + hash + "," + path;

            console.log("update", ci);
            await rungit(["update-index", "--add", "--cacheinfo",
                ci], gitdir, {GIT_INDEX_FILE: index_file});
        },
        commit: async function(opts){
            // git write-tree > $tree
            // git commit-tree $tree -p currentref -m "$opts.msg" > $newref
            // git update-ref $currentref $newref

            const now = new Date();
            const msg = opts.msg ? opts.msg : "Update";
            let commitopts = {
                GIT_AUTHOR_EMAIL: opts.email ? opts.email : "nobody",
                GIT_AUTHOR_NAME: opts.name ? opts.name : "nobody",
                GIT_AUTHOR_DATE: opts.date ? procdate(opts.date) : procdate(now),
                GIT_COMMITTER_EMAIL: opts.committer_email ? opts.committer_email : "nobody",
                GIT_COMMITTER_NAME: opts.committer_name ? opts.committer_name : "nobody",
                GIT_COMMITTER_DATE: opts.commiter_date ? procdate(opts.committer_date) : procdate(now)
            };
            const tree = await rungit(["write-tree"], gitdir, 
                {GIT_INDEX_FILE: index_file});

            const newref = await rungit(["commit-tree", tree, "-p", currentref,
                "-m", msg], gitdir, commitopts);

            await rungit(["update-ref", currentref, newref], gitdir, {});
        },
        dispose: async function(){
            // rm $index_file
            const p = new Promise((res, rej) => {
                fs.rm(index_file, {force: false}, (err) => {
                    // Ignore error
                    res();
                });
            });
            await p;
            return true;
        }
    };
}

function make_reader(gitdir){
    let errstate = false;
    let recv = false;
    const child = child_process.spawn("git", ["cat-file", "--batch"], 
                                      {cwd: gitdir, stdio: ["pipe", "pipe", "inherit"]});


    child.on("error", () => {
        errstate = true;
        child = null;
    });

    let in_header = true;
    let headerbuf = [];
    let bodybuf = [];
    let bodysize = 0;
    let queuedsize = 0;
    child.stdout.on("data", (dat) => {
        function consumebody(buf){
            if((bodysize + 1) == queuedsize + buf.length){
                if(buf.length != 1){
                    bodybuf.push(dat.subarray(0, buf.length - 1));
                }
                const out = Buffer.concat(bodybuf);
                bodybuf = [];
                queuedsize = 0;
                in_header = true;
                recv(out);
            }else{
                bodybuf.push(buf);
                queuedsize += buf.length;
                if(queuedsize > bodysize){
                    throw "something wrong";
                }
            }
        }
        function parseheader(){
            const re = /([0-9a-f]+) blob ([0-9]+)/;
            const header = Buffer.concat(headerbuf).toString("utf8");
            headerbuf = [];
            const m = header.match(re);
            if(m){
                bodysize = parseInt(m[2]);
                in_header = false;
            }else{
                bodysize = 0;
            }
        }

        if(in_header){
            // Read to LF
            const lfidx = dat.indexOf(0x0a /* LF */);
            if(lfidx == -1){
                // Partial header
                headerbuf.push(dat);
            }else{
                if(lfidx != 0){
                    headerbuf.push(dat.subarray(0, lfidx));
                }
                parseheader(); // should now have bodysize
                if(bodysize != false){
                    if(lfidx+1 != dat.length){
                        consumebody(dat.subarray(lfidx + 1, dat.length));
                    }
                }else{
                    // error. Return false as data
                    recv(false);
                }
            }
        }else{
            consumebody(dat);
        }
    });


    return {
        get: async function(ref, path){
            const writedata = ref + ":" + path + "\n";
            return new Promise((res, rej) => {
                if(recv){
                    rej("overlapped");
                }else{
                    recv = function(blob){
                        recv = false;
                        res(blob);
                    };
                    child.stdin.write(writedata, "utf8");
                }
            });
        },
        dispose: async function(){
            return new Promise((res, rej) => {
                child.stdin.end(x => res());
            });
        }
    }
}

export default {
    make_writer: make_writer,
    make_reader: make_reader
};
