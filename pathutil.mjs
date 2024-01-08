function build(str, opts, fmt){
    const consume_hexprefix = fmt.format == "hexpath0" ? true : false;
    const hex0 = str.substring(0, 2);
    const hex1 = str.substring(2, 4);
    const hex2 = consume_hexprefix ? str.substring(4) : str;

    const core = [hex0, hex1, hex2].join("/");

    const prefix = opts.prefix ? opts.prefix : "";
    const suffix = opts.objname? opts.objname : "";

    return prefix + core + suffix;
}

function parse(str, opts, fmt){
    const consume_hexprefix = fmt.format == "hexpath0" ? true : false;
    const prefix = opts.prefix ? opts.prefix : false;

    const re = /([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{11,})(.*)/;

    const s = str.search(re);
    if(s == -1){
        return false;
    }
    const m = str.substring(s).match(re);
    const p = str.substring(0,s);

    const hash = consume_hexprefix ? m[1] + m[2] + m[3] : m[3];
    const objname = m[4];

    return {
        hash: hash, objname: objname, prefix: p
    };
}

export default {
    build: build,
    parse: parse
};
