const fs = require("fs");
const path = require("path");

const srcDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@microsoft",
  "signalr",
  "dist",
  "browser"
);
const destDir = path.join(__dirname, "..", "Assets", "vendor", "signalr");

const files = ["signalr.min.js", "signalr.min.js.map"];

if (!fs.existsSync(srcDir)) {
  throw new Error(
    "SignalR source directory not found. Run npm install first."
  );
}

fs.mkdirSync(destDir, { recursive: true });

for (const file of files) {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing ${file} in ${srcDir}`);
  }

  fs.copyFileSync(srcPath, destPath);
}

console.log("SignalR assets copied to Assets/vendor/signalr");
