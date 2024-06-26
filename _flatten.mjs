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
    const m = await mgr.getnode(commit, ".gitmodules");
    if(!m){
        console.log("NO GITMODULES", myprefix, commit);
        return [];
    }else{
        console.log(m);
        let replaces = [];
        const cfg = await mgr.genconfig(commit);
        const cfg2 = prefixcfg(cfg, myprefix);
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
                const next0 = await step(n.ident, myprefix + name + "_");
                const next = next0.map(e => {
                    const nextpath = e[0];
                    const commit = e[1];
                    return [path + "/" + nextpath, commit];
                });
                const here = [[path, n.ident]].concat(next);
                replaces = replaces.concat(here);
            }else{ /* Standard node */
                /* Do nothing -- .gitmodules is out of sync */
                console.log("Node is not a gitlink", commit, path);
            }
        }
        return replaces;
    }
}

async function do_replace(commit, replaces){
    const writer = gitutil.make_writer("../em2native-tests.git", "TEMP-index");

    await writer.read_tree(false, commit);

    for(const k in replaces){
        const p = replaces[k];
        /* Remove existing gitlink */
        await writer.unset(p[0]);
        /* Replace submodules to tree */
        console.log("Readtree",p);
        await writer.read_tree(p[0], p[1]);
        /* Remove .gitmodules */
        await writer.unset(p[0] + "/.gitmodules");
    }

    /* Remove /.gitmodules */
    await writer.unset(".gitmodules");

    const newcommit = await writer.commit({});
    console.log(newcommit);
    await writer.dispose();
}

const replaces = await step("HEAD", "");
console.log(replaces);
await do_replace("HEAD", replaces);
