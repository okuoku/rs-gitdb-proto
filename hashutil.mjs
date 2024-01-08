import crypto from "node:crypto";

function sha256(str){
    const h = crypto.createHash("sha256");
    h.update(str);
    return h.digest("hex");
}

export default {
    sha256: sha256
};
