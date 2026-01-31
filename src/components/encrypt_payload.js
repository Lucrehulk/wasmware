import fs from "fs";

let encrypt = async (t, key) => {
  let E = new TextEncoder(),
        S = crypto.subtle,
        G = crypto.getRandomValues.bind(crypto)
  let K = async (s) => S.deriveKey(
    {name:"PBKDF2",salt:s,iterations:25e4,hash:"SHA-256"},
    await S.importKey("raw",E.encode(key),"PBKDF2",0,["deriveKey"]),
    {name:"AES-GCM",length:256},0,["encrypt"]
  )
  let s = G(new Uint8Array(16)),
        i = G(new Uint8Array(12)),
        c = await S.encrypt({name:"AES-GCM",iv:i},await K(s),E.encode(t)),
        o = new Uint8Array(28+c.byteLength)
  o.set(s), o.set(i,16), o.set(new Uint8Array(c),28)
  return Buffer.from(o).toString("base64")
};

export default async function encrypt_code() {
  let key = fs.readFileSync("../src/txts/input/key.txt", "utf8");
  let code = fs.readFileSync("../src/txts/input/payload.txt", "utf8");
  let encrypted = await encrypt(code, key);
  fs.writeFileSync("../src/txts/output/encrypted_payload.txt", encrypted, "utf8");
};
