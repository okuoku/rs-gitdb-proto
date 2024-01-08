import gitdb from "./gitdb.mjs";
import process from "node:process";

const writer = gitdb.make_writer("./check", "testing");

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

const reader = gitdb.make_reader("./check");

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