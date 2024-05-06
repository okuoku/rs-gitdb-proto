import gitutil from "./gitutil.mjs";

const mgr = gitutil.make_remotemanager("../em2native-tests.git");
const cfg = await mgr.genconfig("HEAD");

await mgr.setup_config(cfg);
await mgr.do_fetch(cfg);

console.log(cfg);
