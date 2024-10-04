const express = require("express");
const fs = require("fs");
const moment = require("moment");
const sqlite3 = require("sqlite3");
const path = require("path");

const dbname = path.join(__dirname, "habit.db");
const db = new sqlite3.Database(dbname);

const app = express();
const PORT = 3001;
app.use(express.json());
app.get("/users", (req, res) => {
  const users_sql = `select * from users`;
  db.all(users_sql, [], (err, rows) => {
    res.json({ users: rows });
  });
});
app.listen(PORT, () => {
  console.log(`${PORT}에서 서버 실행 중`);
});
