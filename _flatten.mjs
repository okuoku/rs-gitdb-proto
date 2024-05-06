import gitutil from "./gitutil.mjs";

const mgr = gitutil.make_remotemanager("../em2native-tests.git");

function prefixcfg(cfg, prefix){
    return cfg.map(e => {
        return {
            name: prefix + e.name,
            url: e.url
        }
    });
}

async function step(commit, myprefix){
    console.log("Step", commit, myprefix);
    const m = await mgr.getnode(commit, ".gitmodules");
    if(!m){
        console.log("NO GITMODULES", myprefix, commit);
    }else{
        console.log(m);
        const cfg = await mgr.genconfig(commit);
        const cfg2 = prefixcfg(cfg, myprefix);
        console.log("CFG2", cfg2);
        await mgr.setup_config(cfg2);
        await mgr.do_fetch(cfg2);
        const paths = await mgr.getmodulepaths(commit);
        for(const k in paths){
            const path = paths[k].path;
            const name = paths[k].name;
            const n = await mgr.getnode(commit, path);
            console.log(n);
            if(! n /* already removed */){
                /* Do nothing -- .gitmodules is out of sync */
                console.log("Node not found", commit, path);
            }else if(n.type == "commit" /* submodule */){
                await step(n.ident, myprefix + name + "_");
            }else{ /* Standard node */
                /* Do nothing -- .gitmodules is out of sync */
                console.log("Node is not a gitlink", commit, path);
            }
        }
    }
}

await step("HEAD", "");
