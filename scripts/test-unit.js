const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const tests = [];

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019
    },
    fileName: filename
  });
  module._compile(result.outputText, filename);
};

global.describe = (name, fn) => {
  console.log(name);
  fn();
};

global.test = (name, fn) => {
  tests.push({ name, fn });
};

function collectTests(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      return collectTests(absolutePath);
    }
    return entry.endsWith(".test.ts") ? [absolutePath] : [];
  });
}

for (const testFile of collectTests(path.resolve(__dirname, "../tests/unit"))) {
  require(testFile);
}

(async () => {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok ${name}`);
    } catch (error) {
      failures++;
      console.error(`  fail ${name}`);
      console.error(error);
    }
  }

  if (failures) {
    process.exitCode = 1;
  }
})();
