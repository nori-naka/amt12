"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");

const app = express();

const auth = require("./modules/auth");
const config = require("./modules/config");
const track = require("./modules/tracks");

const multer = require("multer");

// tmpフォルダの有無
const tmp_dirname = "./tmp/";
try {
  fs.statSync(tmp_dirname);
} catch (e) {
  fs.mkdirSync(tmp_dirname);
}
const tmp_memo_dirname = "./tmp/memo";
try {
  fs.statSync(tmp_memo_dirname);
} catch (e) {
  fs.mkdirSync(tmp_memo_dirname);
}


// Bodyのパーサー
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
// Cookieのパーサー
app.use(cookieParser());
// セッション
app.use(
  session({
    secret: "pen pineapple apple pen",
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());

//app.use(express.static("map"));
app.use(express.static(path.join(__dirname, "map")));
// app.use(express.static(path.join(__dirname, "data")));
app.use(express.static(path.join(__dirname, "tmp")));

// ログイン可能かどうか(サーバが生きているかどうか)の確認用のAPI
// ローカルのページからのログイン要求にAjaxが使えない(CORS)ため。
app.get("/login_chk", function (req, res) {
  // Ajaxがクロスドメインでも使えるようにヘッダに設定
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.send("OK");
});

// ルートへのgetはログイン画面にリダイレクト
app.get("/", function (req, res) {
  res.redirect(302, "/login.html");
});
// サーバから提供するログイン画面の配置階層
const login_html = express.static(path.join(__dirname, "public"));
// ログイン画面を提供
app.use("/", login_html);
// ログイン処理
//app.post("/login", auth.login);
app.post("/login", (req, res) => {
  if (req.body.pclogin == 1) {
    auth.loginpc(req, res);
  } else {
    auth.login(req, res);
  }
});

// multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "tmp/memo/");
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname);
  }
});
// const upload = multer({ dest: "uploads/" });
const upload = multer({ storage: storage });

// app.use(express.static(path.join(__dirname, "public")));
// app.get("/upload", (req, res) =>
//   res.sendFile(path.join(__dirname, "public/upload.html"))
// );
// app.use(upload);
app.post("/upload", upload.single("data"), function(req, res, next) {
  console.log(req.file);
  console.log("FILE UPLOAD Complete");
  res.send("FILE UPLOAD Complete");
});

// ログインに利用するリクエスト以外は認証を要求
app.use(auth.authOrReject);

// 設定取得要求
app.post("/get_config", config.getConfig);
// 設定更新要求
app.post("/set_config", config.setConfig);

// ログアウト処理
app.get("/logout", function (req, res) {
  req.logout();
  // androidの場合はローカルhtmlに遷移させたいのでリダイレクトはしない
  res.send("logout");
});

app.get("/home", function (req, res) {
  res.redirect("/app");
})

app.post("/tracks", track.getTracks);

// Vueアプリの配置階層
const html = express.static(path.join(__dirname, "dist"));
// メインのアプリに対するアクセス
app.use("/app", html);
// app.use("/home", html);

// API実装時にはアクセスをルーティングしたほうが良いかも

// エラーハンドラ
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send("Internal server error");
});

module.exports = app;
