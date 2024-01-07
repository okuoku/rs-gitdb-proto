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
                    console.log("Removed", err, index_file);
                    // Ignore error
                    res();
                });
            });
            await p;
            return true;
        }
    };
}

export default {
    make_writer: make_writer
};
