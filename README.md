# wasmware
A tool that can modify WebAssembly modules to implement a stub loader that can secretly retrieve and execute a payload.

The concept of wasmware is simple: 

Wasm's obfuscated nature allows for anything to be encoded into memory. Most notably, this can be used to encode text, or more specifically, evaluable JavaScript. So, by creating (or utilizing an already existing) import that evals a slice of utf-8 memory, we can slickly execute code that doesn't immediately appear obvious imports. We also use the WebAssembly to mask the use of eval in the first place, as we access it via globalThis (or "window" in a browser) key access, the key being encoded utf-8 from the WebAssembly. When evaluating, we can then access our main payload where the real malicious code actually resides--the wasmware functionality simply serves as a stub to load such.

Wasmware takes your JS file (containing the glue code) and your WAT file (you can recompile this into a WASM binary), and based on your set config and txt input data, it'll output an encrypted payload (for you to write to your payload request url), and the modified JS and Wat files with the stub implemented into it.

Input the necesssary config and input data into the txts, and run ```node build``` to produce your output files.

Make sure that when you build the output, you ensure that your key.txt input has the key on a single line.

In order to actually execute the wasmware, you'll have to call upon the wasmware export function you build into the WebAssembly module. The code doesn't automatically place a call for you as you could either call this within the WebAssembly or in the JS glue code. All you have to do though is simply call upon this export in order for it to execute.

In case you would like to manually modify the JS file with your imports, or the JS file writer isn't working as intended, I'm leaving the two imports below so you can manually add them yourself. 
```
${wasmware_import_name}: (e, l, f, m) => globalThis[${js_decoder_reference}.decode(${js_u8_reference}.subarray(f, f + m))](${js_decoder_reference}.decode(${js_u8_reference}.subarray(e, e + l)));
${global_setter_import_name}: (e, l, f, m) => globalThis[${js_decoder_reference}.decode(${js_u8_reference}.subarray(f, f + m))] = globalThis[${js_decoder_reference}.decode(${js_u8_reference}.subarray(e, e + l));
```
