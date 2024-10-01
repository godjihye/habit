const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const moment = require("moment");
const dbname = path.join(__dirname, "habbit.db");
const db = new sqlite3.Database(dbname);
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const app = express();
const PORT = 3000;

const create_sql = `
    create table if not exists members(
        id varchar(100) primary key,
        name varchar(100) not null,
        password varchar(255) not null,
        created_at varchar(100)
    );
    create table if not exists habbits(
        id integer primary key autoincrement,
        name varchar(255),
        start_date varchar(100),
        end_date varchar(100),
        created_at varchar(100),
        member_id integer,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );
    create table if not exists habbit_record(
        id integer primary key autoincrement,
        memo text,
        created_at varchar(100),
        habbit_id integer,
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
    res.render("home");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { id, password } = req.body;
  console.log(`id: ${id}, pw: ${password}`);
  let sql = `
    select password from members where id = '${id}'
  `;
  console.log(sql);
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.log(err);
      res.status(500).send(`Internal Server Error`);
    } else {
      let data = JSON.stringify(rows[0]["password"]);
      if (password == data.replace(/\"/gi, "")) {
        req.session.user = {
          id: id,
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
        insert into members values('${id}', '${name}', '${pw}', '${createdAt}')
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
app.listen(PORT, () => {
  console.log(`${PORT}에서 습관 관리 서버 작동중`);
});
