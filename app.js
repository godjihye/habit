const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const moment = require("moment");
const dbname = path.join(__dirname, "habbit.db");
const db = new sqlite3.Database(dbname);
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const { create } = require("domain");
const app = express();
const PORT = 3000;

const create_sql = `
    create table if not exists users(
        id integer primary key,
        email varchar(255),
        name varchar(100) NOT NULL,
        password varchar(255),
        createdAt datetime default now
    );
    create table if not exists habbits(
        id integer primary key autoincrement,
        habbit_name varchar(255),
        start_date datetime,
        end_date datetime,
        createdAt datetime,
        user_id integer NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    create table if not exists records(
        id integer primary key autoincrement,
        memo varchar(255),
        createdAt datetime default now,
        habbit_id integer NOT NULL,
        FOREIGN KEY(habbit_id) REFERENCES habbits(id)
    );
`;

db.serialize(() => {
  db.run(create_sql);
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
      select id, habbit_name, start_date, end_date, createdAt, user_id from habbits where user_id = ${userId} order by 1 desc; 
    `;
    console.log(sql);
    db.all(sql, [], (err, rows) => {
      if (err) {
        res.status(500).send("Internal Server Error");
      } else {
        res.render("home", { habbits: rows });
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
  const { name, id, pw } = req.body;
  const createdAt = moment().format("YYYY-MM-DD");
  let sql = `
        insert into users values('${id}', '${name}', '${pw}', '${createdAt}')
    `;
  db.run(sql, (err) => {
    if (err) {
      res.status(500).send("Internal Server Error");
    } else {
      console.log(`${id} ${pw}로 회원가입 완료`);
      res.redirect("/login");
    }
  });
});

app.get("/remove/:id", (req, res) => {
  const id = req.params.id;
  let sql = `
    delete from habbits where id = ${id}
  `;
  db.run(sql, (err) => {
    if (err) {
      console.log(`err발생 : ${err}`);
    }
  });
  res.redirect("/");
});

app.get("/create", (req, res) => {
  res.render("create");
});
app.post("/create", (req, res) => {
  const { habbit_name, start_date, end_date } = req.body;
  const userData = req.session.user;
  const userId = userData["id"];
  const createdAt = moment().format("YYYY-MM-DD");

  let sql = `
    insert into habbits(habbit_name, start_date, end_date, createdAt, user_id) values(
      '${habbit_name}', '${start_date}', '${end_date}', '${createdAt}', ${userId}
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

app.get("/record/:id", (req, res) => {
  const id = req.params.id;
  console.log(id);
  let sql = `
    select r.id as id, r.memo as memo, r.created_at as created_at, h.habbit_name as habbit_name
    from records r inner join habbits h
    where r.habbit_id = h.id and r.habbit_id=${id} order by 1 desc
  `;

  console.log(sql);
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.log(err);
      res.status(500).send("Internal Server Error");
    } else {
      console.log(rows);
      res.render("record", { records: rows });
    }
  });
});
/*
id integer primary key autoincrement,
        memo text,
        created_at varchar(100),
        habbit_id integer,
*/
app.listen(PORT, () => {
  console.log(`${PORT}에서 습관 관리 서버 작동중`);
});
