import fs from "fs";
import {
    module_name,
    wasmware_import_name,
    global_setter_import_name,
    wasmware_import_func_name,
    global_setter_import_func_name
} from "../build_config.js";

let import_before_func = false;
let func_type;
let use_func_names = true;
let wasmware_import_signature = -1;
let global_setter_import_signature = -1;

function create_import_line(import_name, import_func_name, signature_num) {
    let signature_num_comment = signature_num == -1 ? " " : ` (;${signature_num};) `;
    let func_type_structure =
        func_type == undefined
            ? "(param i32 i32 i32 i32)"
            : `(type ${func_type})`;
    let func_name = use_func_names ? " " + import_func_name : " ";
    return import_before_func
        ? `(import "${module_name}" "${import_name}" (func${func_name}${signature_num_comment}${func_type_structure}))`
        : `(func${func_name}${signature_num_comment}(import "${module_name}" "${import_name}") ${func_type_structure})`;
};

const import_line_regex = /^\s*(?:\(import|\(func\s+\(import)/;
const import_first_regex = /^\s*\(import\s+"([^"]+)"\s+"([^"]+)"\s+\(func(.*)\)\s*\)\s*$/;
const func_first_regex = /^\s*\(func(.*?)\(import\s+"([^"]+)"\s+"([^"]+)"\)(.*)\)\s*$/;
const signature_regex = /\(;(\d+);\)/;
const type_regex = /\(type\s+(\$[^\s()]+|\d+)\)/;
const param_regex = /\(param\s+([^)]+)\)/;
const func_name_regex = /^\s*\$([^\s()]+)/;
const type_def_regex = /^\s*\(type\s+(?:(?:\(;(\d+);\))|(\$[^\s()]+))\s+\(func\s*(?:\(param\s+([^)]+)\))?\s*(?:\(result\s+([^)]+)\))?\s*\)\s*\)\s*$/;

export default async function rewrite_wat_with_imports() {
    let watfile = fs.readFileSync("../src/txts/input/wat.txt", "utf8");
    let lines = watfile.split("\n");
    let last_import_index = -1;
    let last_signature = -1;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let match;
        let func_blob = "";
        if ((match = line.match(import_first_regex))) {
            import_before_func = true;
            func_blob = match[3];
        } else if ((match = line.match(func_first_regex))) {
            import_before_func = false;
            func_blob = match[1] + match[4];
        } else if (import_line_regex.test(line)) {
            last_import_index = i;
            continue;
        } else {
            continue;
        }
        last_import_index = i;
        if (!func_name_regex.test(func_blob)) use_func_names = false;
        let signature_match = func_blob.match(signature_regex);
        if (signature_match) {
            let n = Number(signature_match[1]);
            if (n > last_signature) last_signature = n;
        }
        let type_match = func_blob.match(type_regex);
        if (type_match) {
            let t = type_match[1];
            func_type = /^\d+$/.test(t) ? Number(t) : t;
        } else if (param_regex.test(func_blob)) {
            func_type = undefined;
        }
    }
    if (func_type != undefined) {
        let resolved = false;
        for (let i = 0; i < lines.length; i++) {
            let match = lines[i].match(type_def_regex);
            if (!match) continue;
            let type_index = match[1] != undefined ? Number(match[1]) : undefined;
            let type_name = match[2] || undefined;
            if (
                (typeof func_type == "number" && type_index == func_type) ||
                (typeof func_type == "string" && type_name == func_type)
            ) {
                let params = match[3] ? match[3].trim() : "";
                let result = match[4];
                if (params == "i32 i32 i32 i32" && !result) resolved = true;
                break;
            }
        }
        if (!resolved) func_type = undefined;
    }
    if (last_signature != -1) {
        wasmware_import_signature = last_signature + 1;
        global_setter_import_signature = last_signature + 2;
    }
    let indent = "  ";
    if (last_import_index != -1) indent = lines[last_import_index].match(/^\s*/)[0];
    lines.splice(
        last_import_index + 1,
        0,
        indent + create_import_line(wasmware_import_name, wasmware_import_func_name, wasmware_import_signature),
        indent + create_import_line(global_setter_import_name, global_setter_import_func_name, global_setter_import_signature)
    );
    watfile = lines.join("\n");
    fs.writeFileSync("../src/txts/output/wat.txt", watfile, "utf8");
};
