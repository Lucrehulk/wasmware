import fs from "fs";
import {
    module_name,
    js_u8_reference,
    js_decoder_reference,
    tab_size,
    wasmware_import_name,
    global_setter_import_name
} from "../build_config.js";

export default async function rewrite_js_with_imports() {
    let input_path = "../src/txts/input/js.txt";
    let output_path = "../src/txts/output/js.txt";
    let js = fs.readFileSync(input_path, "utf8");
    let wasm_call = js.match(/WebAssembly\.(instantiate|instantiateStreaming)\s*\([^,]+,\s*(\w+)/);
    if (!wasm_call) throw new Error("Could not locate WebAssembly instantiate call");
    let imports_var = wasm_call[2];
    let assign_regxp = new RegExp(`\\b${imports_var}\\s*=`);
    let assign_match = assign_regxp.exec(js);
    if (!assign_match) throw new Error(`Could not find assignment for ${imports_var}`);
    let cursor = assign_match.index + assign_match[0].length;
    while (/\s/.test(js[cursor])) cursor++;
    let root_char = js[cursor];
    if (root_char != '{' && root_char != '[') throw new Error(`Unsupported imports root type: ${root_char}`);
    function find_matching(start) {
        let open = js[start];
        let close = open == '{' ? '}' : ']';
        let depth = 0;
        let in_str = null;
        let in_comment = null;
        for (let i = start; i < js.length; i++) {
            let char = js[i];
            let next_char = js[i + 1];
            if (in_comment) {
                if (in_comment == '//' && char == '\n') {
                    in_comment = null;
                } else if (in_comment == '/*' && char == '*' && next_char == '/') { 
                    in_comment = null; 
                    i++; 
                }
                continue;
            }
            if (!in_str) {
                if (char == '/' && next_char == '/') { 
                    in_comment = '//'; 
                    i++; 
                    continue; 
                }
                if (char == '/' && next_char == '*') { 
                    in_comment = '/*'; 
                    i++; 
                    continue; 
                }
            }
            if (!in_str && (char == '"' || char == '\'' || char == '`')) { 
                in_str = char; 
                continue; 
            }
            if (in_str) {
                if (char == '\\') { 
                    i++; 
                    continue; 
                }
                if (char == in_str) in_str = null;
                continue;
            }
            if (char == open) depth++;
            if (char == close) {
                depth--;
                if (depth == 0) return i;
            }
        }
        throw new Error(`Imports structure is missing ending "]" or "}"`);
    }
    let root_start = cursor;
    let root_end = find_matching(root_start);
    let is_root_array = root_char == '[';
    let module_open = -1;
    let module_close = -1;
    let module_is_array = false;
    if (!is_root_array) {
        let key_regxp = new RegExp(`(?:['\"]${module_name}['\"]|\\b${module_name}\\b)\\s*:`);
        let slice = js.slice(root_start, root_end);
        let key_match = key_regxp.exec(slice);
        if (!key_match) throw new Error(`Module '${module_name}' not found in imports object`);
        let i = root_start + key_match.index + key_match[0].length;
        while (/\s/.test(js[i])) i++;
        if (js[i] != '{') throw new Error(`Module '${module_name}' is not an object`);
        module_open = i;
        module_close = find_matching(i);
        module_is_array = false;
    } else {
        let first_entry = -1;
        for (let i = root_start + 1; i < root_end; i++) {
            if (/\s|,/.test(js[i])) continue;
            if (js[i] == '{' || js[i] == '[') { 
                first_entry = i; 
                break; 
            }
        }
        if (first_entry == -1) throw new Error("Imports array is empty");
        let module_index = Number(module_name);
        if (!Number.isInteger(module_index) || module_index < 0) throw new Error(`Array-based imports require numeric module_name, got '${module_name}'`);
        let current_index = 0;
        let i = first_entry;
        while (i < root_end) {
            if (js[i] == '{' || js[i] == '[') {
                if (current_index == module_index) {
                    module_open = i;
                    module_close = find_matching(i);
                    module_is_array = js[i] == '[';
                    break;
                }
                i = find_matching(i) + 1;
                current_index++;
                continue;
            }
            i++;
        }
        if (module_open == -1) throw new Error(`Module index ${module_index} not found in imports array`);
    }
    let indent = "";
    let bracket_indent = "";
    let last_nl = js.lastIndexOf('\n', module_close - 1);
    if (last_nl !== -1) {
        let second_last_nl = js.lastIndexOf('\n', last_nl - 1);
        let start_of_line = second_last_nl + 1;
        for (let i = start_of_line; i < js.length; i++) {
             if (js[i] == ' ' || js[i] == '\t') {
                 indent += js[i];
             } else break;
        }
    }
    bracket_indent = indent == "" ? "" : indent.substring(0, indent.length - tab_size);
    let wasmware_func = `(e, l, f, m) => globalThis[${js_decoder_reference}.decode(${js_u8_reference}.subarray(f, f + m))](${js_decoder_reference}.decode(${js_u8_reference}.subarray(e, e + l)))`;
    let global_setter_func = `(e, l, f, m) => globalThis[${js_decoder_reference}.decode(${js_u8_reference}.subarray(f, f + m))] = globalThis[${js_decoder_reference}.decode(${js_u8_reference}.subarray(e, e + l))]`;
    let insertion;
    if (module_is_array) {
        insertion = `\n${indent}${wasmware_func},\n${indent}${global_setter_func}`;
    } else {
        insertion = `\n${indent}${wasmware_import_name}: ${wasmware_func},\n${indent}${global_setter_import_name}: ${global_setter_func}`;
    }
    let needs_comma = false;
    let comma_pos = module_close;
    for (let i = module_close - 1; i > module_open; i--) {
        if (/\s/.test(js[i])) continue;
        if (js[i] != '{' && js[i] != '[' && js[i] != ',') needs_comma = true;
        comma_pos = i + 1;
        break;
    }
    let middle = js.slice(comma_pos, module_close);
    middle = middle.replace(/^[\s\n]+/, ""); 
    let out = js.slice(0, comma_pos) + (needs_comma ? "," : "") + middle + insertion + `\n${bracket_indent}` + js.slice(module_close);
    fs.writeFileSync(output_path, out, "utf8");
};
