#!/usr/bin/env node
// const app = require("./app");
const websock = require("./websock");
const express = require("express");
const SSL_KEY = "server.key";
const SSL_CERT = "server.crt";
const https = require("https");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const options = {
  key: fs.readFileSync(SSL_KEY).toString(),
  cert: fs.readFileSync(SSL_CERT).toString()
};
const https_port = 10443;

console.log(`エアマルチトーク　サーバ起動 : ${new Date().toLocaleTimeString()}`);

fs.mkdir("tmp", function (err) {
    if (err) console.log(`ERROR MKDIR : TMP Folder :$`);
    else console.log(`MKDIR TMP Folder SUCCEES`);
})

const app = express();
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, "/login.html"));
});
app.get('/index.html', function (req, res) {
    if (!req.query.group_id) {
        res.sendFile(path.join(__dirname, "/login.html"));
    } else {
        res.sendFile(path.join(__dirname, "/index.html"));
    }
});
app.use(express.static("./"));
app.set("port", process.env.PORT || https_port);
const https_server = https.createServer(options, app);

var server = https_server.listen(app.get("port"), function() {
  console.log("Express server listening on port " + server.address().port);
});

// multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./tmp/");
  },
  filename: function (req, file, cb) {
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
app.post("/upload", upload.single("data"), function (req, res, next) {
  console.log(req.file);
  console.log("FILE UPLOAD Complete");
  res.send("FILE UPLOAD Complete");
});

//Web Socket Server
websock(server);
