import { Database } from "bun:sqlite";

export const db = new Database("myDatabase.sqlite");

db.run(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL
  )
`);

const initialItems = [
  { name: "Item 1", description: "This is the first item." },
  { name: "Item 2", description: "This is the second item." },
  { name: "Item 3", description: "This is the third item." },
];

console.log(db.query("SELECT COUNT(*) as total FROM items").all());

db.query("SELECT COUNT(*) as total FROM items")
  .all()
  .forEach((record) => {
    if (record.total === 0) {
      initialItems.forEach((currentItem) => {
        db.run("INSERT INTO items (name, description) VALUES (?, ?)", [
          currentItem.name,
          currentItem.description,
        ]);
      });
    }
  });
