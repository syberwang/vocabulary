import crypto from "node:crypto";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").trimEnd();
if (password.length < 12) {
  console.error("Password must contain at least 12 characters.");
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt:${salt}:${hash}`);
