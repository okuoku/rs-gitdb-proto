import gitutil from "./gitutil.mjs";
import process from "node:process";

const writer = gitutil.make_writer("./check", "testing");

await writer.init("refs/heads/master");
await writer.set("a/bbb.json", JSON.stringify(1234));
await writer.set("a/ccc.json", JSON.stringify({mypid: process.pid}));
const x = await writer.hash(JSON.stringify({mypid: process.pid}));
const y = await writer.hash(JSON.stringify(4567));
const cmd = [{path: "b/bbb.json", hash: x}, {path: "b/ddd.json", hash: y}];
console.log("cmd", cmd);
await writer.bulkset(cmd);
await writer.commit({msg: "Testing"});
await writer.dispose();

const reader = gitutil.make_reader("./check");

async function dbg(a, b){
    const obj = await reader.get(a, b);
    console.log(a,b,obj.toString("utf8"));
    return true;
}

await dbg("refs/heads/master", "a/ccc.json");
await dbg("refs/heads/master^1", "a/ccc.json");
await dbg("refs/heads/master", "a/xccc.json");
await dbg("refs/heads/master0", "a/xccc.json");
await reader.dispose();

const e = gitutil.make_enumerator("./check");

const refs = await e.refs();
const head = refs["refs/heads/master"];
const ops = await e.diff(e.empty_commit, head);
console.log("ops", ops);

const h = await e.history_linear(e.empty_commit, head);
console.log(h);
let prev = e.empty_commit;
let q = [];
while(h.length != 0){
    let x = h.pop();
    q.push([prev, x]);
    prev = x;
}
for(const w in q){
    const dif = await e.diff(q[w][0],q[w][1]);
    console.log(dif);
}

console.log(await e.commit_info("HEAD"));
