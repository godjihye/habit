const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const moment = require("moment");
const dbname = path.join(__dirname, "habit.db");
const db = new sqlite3.Database(dbname);
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const { create } = require("domain");
const app = express();
const PORT = 3000;

const create_users_sql = `
  create table if not exists users(
    id integer primary key,
    email varchar(255),
    name varchar(100) NOT NULL,
    password varchar(255),
    createdAt datetime default CURRENT_TIMESTAMP
  )
`;
const create_habits_sql = `
  create table if not exists habits(
    id integer primary key autoincrement,
    habit_name varchar(255),
    start_date datetime,
    end_date datetime,
    createdAt datetime default CURRENT_TIMESTAMP,
    user_id integer NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`;
const create_records_sql = `
  create table if not exists records(
    id integer primary key autoincrement,
    memo varchar(255),
    createdAt datetime default CURRENT_TIMESTAMP,
    habit_id integer NOT NULL,
    FOREIGN KEY(habit_id) REFERENCES habits(id)
  )
`;

db.serialize(() => {
  db.run(create_users_sql);
  db.run(create_habits_sql);
  db.run(create_records_sql);
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("public"));

app.use(
  expressSession({
    secret: "sample",
    resave: true,
    saveUninitialized: true,
  })
);

app.get("/", (req, res) => {
  if (req.session.user) {
    const userData = req.session.user;
    const userId = userData["id"];
    console.log(userId);
    let sql = `
      SELECT h.id as id, h.habit_name as habit_name, h.start_date as start_date, h.end_date as end_date, COUNT(r.habit_id) AS record_count FROM habits h LEFT JOIN records r ON h.id = r.habit_id WHERE h.user_id = ${userId} GROUP BY h.id, h.habit_name,h.start_date, h.end_date; 
    `;
    console.log(sql);
    db.all(sql, [], (err, rows) => {
      if (err) {
        res.status(500).send("Internal Server Error");
      } else {
        res.render("home", { habits: rows });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log(`email: ${email}, pw: ${password}`);
  let sql = `
    select id, password from users where email = '${email}'
  `;
  console.log(sql);
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.log(err);
      res.status(500).send(`Internal Server Error`);
    } else {
      console.log(rows[0]);
      console.log(rows[0]["password"]);
      let data = JSON.stringify(rows[0]["password"]);
      if (password == data.replace(/\"/gi, "")) {
        req.session.user = {
          id: rows[0]["id"],
          authorized: true,
        };
        setTimeout(() => {
          console.log(`login success!`);
          res.redirect("/");
        }, 3000);
      } else {
        console.log(`${password} != ${data}`);
        res.redirect("/login");
      }
    }
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const { name, email, pw } = req.body;
  const check_dup_email_sql = `select count(1) as count from users where email = '${email}'`;
  db.get(check_dup_email_sql, (err, row) => {
    console.log(row);
    if (err) {
      res.status(500).send("Internal Server Error");
    }
    console.log(row.count);
    if (row.count > 0) {
      res.status(200).send("already Email..");
    } else {
      let insert_user_sql = `
        insert into users(email, name, password) values('${email}','${name}' ,'${pw}')
    `;
      db.run(insert_user_sql);
      res.redirect("/login");
    }
  });
});

app.get("/remove/:id", (req, res) => {
  const id = req.params.id;
  let sql = `
    delete from habits where id = ${id}
  `;
  db.run(sql, (err) => {
    if (err) {
      console.log(`err발생 : ${err}`);
    }
  });
  res.redirect("/");
});

app.get("/habit/add", (req, res) => {
  res.render("createhabit");
});
app.post("/habit/add", (req, res) => {
  const { habit_name, start_date, end_date } = req.body;
  const userData = req.session.user;
  const userId = userData["id"];
  const createdAt = moment().format("YYYY-MM-DD");

  let sql = `
    insert into habits(habit_name, start_date, end_date, createdAt, user_id) values(
      '${habit_name}', '${start_date}', '${end_date}', '${createdAt}', ${userId}
    )
  `;
  console.log(sql);
  db.run(sql, (err) => {
    if (err) {
      console.log(`err: ${err}`);
    }
  });
  res.redirect("/");
});

app.get("/habit/:id/record", (req, res) => {
  const habitId = req.params.id;
  console.log(habitId);
  let sql = `
    select r.id as id, r.memo as memo, r.createdAt as createdAt, h.habit_name as habit_name
    from records r inner join habits h
    where r.habit_id = h.id and r.habit_id=${habitId} order by 1 desc
  `;

  console.log(sql);
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.log(err);
      res.status(500).send("Internal Server Error");
    } else {
      console.log(rows);
      res.render("record", { records: rows, habit: habitId });
    }
  });
});

app.get("/habit/:id/record/add", (req, res) => {
  res.render("createrecord");
});
app.post("/habit/:id/record/add", (req, res) => {
  const habitId = req.params.id;
  const data = req.body;
  const memo = data["memo"];
  let sql = `
  insert into records(memo, habit_id) values('${memo}', ${habitId})
  `;
  db.run(sql);
  res.redirect(`/habit/${habitId}/record`);
});
app.get("/habit/:id/record/remove/:rid", (req, res) => {
  const id = req.params.id;
  const rid = req.params.rid;
  let sql = `
    delete from records where id = ${rid}
  `;
  db.run(sql);
  res.redirect(`/habit/${id}/record`);
});
app.listen(PORT, () => {
  console.log(`${PORT}에서 습관 관리 서버 작동중`);
  console.log("http://localhost:3000/");
  console.log("email: user01@abc.com\npw: qwer1234");
});
