const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const moment = require("moment");
const dbname = path.join(__dirname, "habit.db");
const db = new sqlite3.Database(dbname);
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
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

    let page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    let sql = `select row_number() over(order by id) as rn, id, habit_name, start_date, end_date, (select count(1) from records r where r.habit_id = h.id) count from habits h where user_id = ${userId} ORDER BY h.id desc limit ? offset ?`;
    db.all(sql, [limit, offset], (err, rows) => {
      if (err) {
        res.status(500).send(`Internal Server Error\n${err}`);
      }
      db.get(`select count(1) as count from habits`, (err, row) => {
        if (err) {
          res.status(500).send(`Internal Server Error\n${err}`);
        } else {
          const total = row.count;
          const totalPage = Math.ceil(total / limit);
          res.render("home", {
            habits: rows,
            currentPage: page,
            totalPage: totalPage,
          });
        }
      });
    });
    // let sql = `
    //   SELECT h.id as id, h.habit_name as habit_name, h.start_date as start_date, h.end_date as end_date, COUNT(r.habit_id) AS record_count FROM habits h LEFT JOIN records r ON h.id = r.habit_id WHERE h.user_id = ${userId} GROUP BY h.id, h.habit_name,h.start_date, h.end_date ORDER BY h.id desc
    // `;
    // let sql2 = `select id, habit_name, start_date, end_date, (select count(1) from records r where r.habit_id=h.id) count from habits h where user_id=${userId} ORDER BY h.id desc`;

    // db.all(sql2, [], (err, rows) => {
    //   if (err) {
    //     res.status(500).send("Internal Server Error");
    //   } else {
    //     res.render("home", { habits: rows });
    //   }
    // });
  } else {
    res.redirect("/login");
  }
});
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      res.status(500).send("Failed to log out");
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log(`email: ${email}, pw: ${password}`);
  let sql = `
    select * from users where email = '${email}' and password = '${password}'
  `;
  db.all(sql, [], (err, row) => {
    if (err) {
      console.log(err);
      res.status(500).send(`Internal Server Error`);
    }
    console.log(row.count);
    if (row.length > 0) {
      console.log(row);
      req.session.user = {
        id: row[0]["id"],
        authorized: true,
      };
      setTimeout(() => {
        console.log(`login success!`);
        res.redirect("/");
      }, 500);
    } else {
      res.redirect("/login");
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
    insert into habits(habit_name, start_date, end_date, user_id) values(
      '${habit_name}', '${start_date}', '${end_date}', ${userId}
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
app.get("/habit/edit/:id", (req, res) => {
  const habitId = req.params.id;
  const sql = `select habit_name, start_date, end_date from habits where id = ?`;
  db.all(sql, [habitId], (err, row) => {
    if (err) {
      res.status(500).send(`Internal Server Error\n${err}`);
    }
    res.render("edithabit", { habit: row[0] });
  });
});
app.post("/habit/edit/:id", (req, res) => {
  const habitId = req.params.id;
  let sql = `update habits 
  set habit_name = '${req.body.habit_name}', start_date = '${req.body.start_date}', 
  end_date = '${req.body.end_date}'
  where id=${habitId}`;
  db.run(sql, (err) => {
    if (err) {
      res.status(500).send("Internal Server Error");
    }
    res.redirect("/");
  });
});
app.get("/habit/:id/record", (req, res) => {
  const habitId = req.params.id;
  console.log(habitId);
  let sql = `
    select r.id as id, r.memo as memo, r.createdAt as createdAt, h.habit_name as habit_name
    from records r inner join habits h
    where r.habit_id = h.id and r.habit_id=${habitId} order by 1 desc
  `;
  // let sql = `
  //   select row_number() over(order by id) as rn,
  //   r.id as id, r.memo as memo, r.createdAt as createdAt, h.habit_name as habit_name
  //   from records r inner join habits h
  //   where r.habit_id = h.id and r.habit_id=${habitId} order by 1 desc
  // `;
  const record_sql = `
    select row_number() over(order by id) as rn, id, memo, createdAt from records where habit_id = ?
  `;
  db.all(record_sql, [habitId], (err, rows) => {
    if (err) {
      res.status(500).send(`Internal Server Error\n${err}`);
    }
    res.render("record", {
      habit_id: habitId,
      records: rows,
    });
  });
  // db.all(sql, [], (err, rows) => {
  //   if (err) {
  //     console.log(err);
  //     res.status(500).send("Internal Server Error");
  //   } else {
  //     console.log(rows);
  //     res.render("record", { records: rows, habit: habitId });
  //   }
  // });
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
app.get("/habit/:hid/record/:rid/remove", (req, res) => {
  const hid = req.params.hid;
  const rid = req.params.rid;
  let sql = `
    delete from records where id = ${rid}
  `;
  db.run(sql);
  res.redirect(`/habit/${rid}/record`);
});
app.get("/habit/:hid/record/:rid/edit", (req, res) => {
  const hid = req.params.hid;
  const rid = req.params.rid;
  let sql = `select memo from records where id = ?`;
  db.all(sql, [rid], (err, row) => {
    if (err) {
      res.status(500).send(`Internal Server Error\n${err}`);
    }
    res.render("editrecord", { record: row[0] });
  });
});
app.post("/habit/:hid/record/:rid/edit", (req, res) => {
  const { hid, rid } = req.params;
  let sql = `update records set memo = '${req.body.memo}' where id=${rid}`;
  console.log(sql);
  db.run(sql, (err) => {
    if (err) {
      res.status(500).send(`Internal Server Error : ${err}`);
    }
    res.redirect(`/habit/${hid}/record`);
  });
});
app.get("/habit/:hid/record/:rid/remove");
app.listen(PORT, () => {
  console.log(`${PORT}에서 습관 관리 서버 작동중`);
  console.log("http://localhost:3000/");
  console.log("email: user01@abc.com\npw: qwer1234");
});
