import hashutil from "./hashutil.mjs";
import pathutil from "./pathutil.mjs";

const name = hashutil.sha256("sha256");

const f0 = {format: "hexpath0"};
const f1 = {format: "hexpath"};

const t0 = pathutil.build(name, {prefix: "objects/", objname: ".bin"}, f0);
const t1 = pathutil.build(name, {prefix: "objects/", objname: ".bin"}, f1);
const x0 = pathutil.build(name, {prefix: "objects/", objname: "/bin"}, f0);
const x1 = pathutil.build(name, {prefix: "objects/", objname: "/bin"}, f1);

console.log(pathutil.parse(t0, {}, f0));
console.log(pathutil.parse(t1, {}, f1));
console.log(pathutil.parse(x0, {}, f0));
console.log(pathutil.parse(x1, {}, f1));
