const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "data", "store.json");

const emptyStore = () => ({
  users: [],
  cars: [],
  subscriptions: [],
  transactions: [],
  parkingSessions: [],
  rewardRedemptions: [],
});

function ensureStoreFile() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), "utf8");
  }
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(storePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), "utf8");
    return emptyStore();
  }
}

function writeStore(data) {
  ensureStoreFile();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf8");
}

/** Mutate the store in place; `fn(store)` should return the value to pass back to the caller. */
function mutateStore(fn) {
  const data = readStore();
  const result = fn(data);
  writeStore(data);
  return result;
}

module.exports = {
  readStore,
  writeStore,
  mutateStore,
  emptyStore,
  storePath,
};
