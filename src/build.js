import encrypt_payload from "./components/encrypt_payload.js";
import rewrite_wat_with_imports from "./components/wat_imports_writer.js";
import rewrite_js_with_imports from "./components/js_imports_writer.js";
import rewrite_wat_with_wasmware_func from "./components/wasmware_func_writer.js";

console.log("Beginning wasmware build...\n");

console.log("Encrypting payload...");

await encrypt_payload();

console.log("Payload successfully encrypted at /txts/output/encrypted_payload.txt\n");

console.log("Rewriting WAT file with wasmware imports...");

await rewrite_wat_with_imports();

console.log("Successfully rewrote the WAT file\n");

console.log("Rewriting JS file with wasmware imports...");

await rewrite_js_with_imports();

console.log("Successfully rewrote the JS file at /txts/output/js.txt\n");

console.log("Rewriting WAT file with wasmware func...");

await rewrite_wat_with_wasmware_func();

console.log("Successfully rewrote the WAT file at /txts/output/wat.txt\n");

console.log("Wasmware build complete.");
