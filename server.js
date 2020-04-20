// required or dependent modules
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const shortid = require("shortid");
const mongoose = require("mongoose");

//mongoose defintions
// mongoose.Promise = global.Promise;
mongoose.connect(
  process.env.M_URI,
  {
    useNewUrlParser: true,
    // useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  },
  (err, database) => {
    if (err) throw err;
    console.log("connects to db");
  }
);

//middlewares
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

//function
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

//create schema and model
const Schema = mongoose.Schema;
const UserSchema = new Schema({
  _id: { type: String, default: shortid.generate },
  username: {
    type: String,
    required: "{PATH} is required"
  },
  count: { type: Number, default: 0 },
  log: Array
});
const User = mongoose.model("User", UserSchema);

//defining new  routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.post("/api/exercise/new-user", (req, res) => {
  //define done
  const render = (nul, data) => {
    res.json(data);
  };

  const createAndSaveUser = done => {
    let username = req.body.username;
    User.findOne({ username }, (err, data) => {
      if (data !== null) {
        res.send("username already taken");
      } else {
        let NewUser = new User({
          username
        });
        NewUser.save((err, data) => {
          if (err) {
            res.send(err.errors.username.message);
          } else {
            let { _id, username } = data;
            res.json({ _id, username });
          }
        });
      }
    });
  };

  createAndSaveUser(render);
});

app.get("/api/exercise/users", (req, res) => {
  User.find({}, (err, data) => {
    if (err) throw err;
    res.json(data.map(user => ({ _id: user._id, username: user.username })));
  });
});

app.post("/api/exercise/add", (req, res) => {
  let { userId, description, duration, date } = req.body;

  if (date == "") {
    date = new Date().toDateString();
  } else if (isValidDate(new Date(date))) {
    date = new Date(date).toDateString();
  }
  console.log(date);
  if (userId && description && duration) {
    console.log(!isNaN(duration), isNaN(date));
    if (!isNaN(duration)) {
      console.log("entering");
      User.findOneAndUpdate(
        { _id: userId },
        {
          $push: {
            log: {
              description,
              duration: Number(duration),
              date: date
            }
          },
          $inc: { count: 1 }
        },
        { new: true },
        (err, data) => {
          if (err) {
            res.send(err);
          } else if (data) {
            let { _id, username, log } = data;
            let { description, duration, date } = log[log.length - 1];

            res.json({
              _id: data._id,
              username: data.username,
              description,
              duration,
              date
            });
          } else {
            res.send("Invalid Id");
          }
        }
      );
    } else if (isNaN(duration)) {
      res.send("Duration must be Number");
    } else if (isNaN(date)) {
      res.send("Date must be Number");
    }
  } else if (!userId) {
    res.send("userId required");
  } else if (!description) {
    res.send("description required");
  } else if (!duration) {
    res.send("duration required");
  }
});

app.get("/api/exercise/log", (req, res) => {
  let { userId, from, to, limit } = req.query;
  from = from ? new Date(from).toDateString() : false;
  to = to ? new Date(to).toDateString() : false;
  limit = limit && Number(limit) !== 0 ? Number(limit) : false;
  console.log(req.query);

  User.findById(req.query.userId, (err, data) => {
    if (err) throw err;
    let { username, _id, count, log } = data;
    if (data) {
      if (isValidDate(from) && isValidDate(to) && limit) {
        res.json({
          _id,
          username,
          count,
          from,
          to,
          log: log
            .filter(ex => ex.date >= from && ex.date <= to)
            .slice(0, limit)
        });
      } else if (isValidDate(from) && isValidDate(to)) {
        res.json({
          _id,
          username,
          count,
          from,
          to,
          log: log.filter(ex => ex.date >= from && ex.date <= to)
        });
      } else if (isValidDate(from)) {
        res.json({
          _id,
          username,
          count,
          from,
          log: log.filter(ex => ex.date >= from)
        });
      } else if (isValidDate(to)) {
        res.json({
          _id,
          username,
          count,

          to,
          log: log.filter(ex => ex.date <= to)
        });
      } else if (limit) {
        res.json({
          _id,
          username,
          count,
          log: log.slice(0, limit)
        });
      } else {
        res.json({
          _id,
          username,
          count,
          log
        });
      }
    } else {
      res.send("invalid id");
    }
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
