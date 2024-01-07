import gitdb from "./gitdb.mjs";
import process from "node:process";

const writer = gitdb.make_writer("./check", "testing");

await writer.init("refs/heads/master");
await writer.set("a/bbb.json", JSON.stringify(1234));
await writer.set("a/ccc.json", JSON.stringify({mypid: process.pid}));
await writer.commit({msg: "Testing"});
await writer.dispose();
