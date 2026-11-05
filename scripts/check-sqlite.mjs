import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
console.log(db.prepare("SELECT sqlite_version() AS versi").get());