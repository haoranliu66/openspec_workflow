import assert from "node:assert";

import { buildInvocation } from "../lib/openspec-cli";

const windows = buildInvocation(
  "win32",
  ["validate", "add-example", "--strict"],
  "C:\\Windows\\System32\\cmd.exe",
);
assert.deepStrictEqual(windows, {
  command: "C:\\Windows\\System32\\cmd.exe",
  args: ["/d", "/s", "/c", "openspec.cmd validate add-example --strict"],
});

const unix = buildInvocation("linux", ["schema", "validate", "product-change"]);
assert.deepStrictEqual(unix, {
  command: "openspec",
  args: ["schema", "validate", "product-change"],
});

[
  "",
  " ",
  "bad & whoami",
  "bad|whoami",
  "bad<in",
  "bad>out",
  "bad^escape",
  "bad%PATH%",
  "bad!value!",
  "bad\"quote",
  "bad'quote",
  "../bad",
  "bad/name",
  "bad\\name",
  "bad\nname",
].forEach((unsafeArgument) => {
  assert.throws(
    () => buildInvocation("win32", ["validate", unsafeArgument, "--strict"]),
    /Unsafe OpenSpec argument/,
  );
});

process.stdout.write("PASS builds safe platform-specific OpenSpec invocations.\n");
