const express = require("express");
const app = express();
const port = 80;
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const crypto = require("crypto");
const ddbw = require("DDBW");
const fs = require("fs");
const path = require("path");
const formidable = require("formidable");

ddbw.init();
ddbw.newDatabase("microhosterdb");

var connection = new ddbw.Connection("microhosterdb");

connection.newCollection("users");
connection.newCollection("files");

app.set("view engine", "ejs");

app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());

app.get("/", (req, res) => {
    var userCookie = req.cookies["userCookie"];

    if (userCookie == null) {
        userCookie = false;
    }

    res.render("index", {username: userCookie.username});
});

app.get("/file/:id", (req, res) => {
    var userCookie = req.cookies["userCookie"];
    var file = connection.getDoc("files", req.params.id);

    if (userCookie == null) {
        userCookie = false;
    }
    
    if (file.exists) {
        res.render("file", {username: userCookie.username, file: file});
    } else {
        return res.redirect("/404");
    }
});

app.get("/file/:id/download", (req, res) => {
    var userCookie = req.cookies["userCookie"];
    var file = connection.getDoc("files", req.params.id);

    if (userCookie == null) {
        userCookie = false;
    }
    
    if (file.exists) {
        res.download(path.join(__dirname, "/public/files/", req.params.id, "/", file.data.file));
    } else {
        return res.redirect("/404");
    }
});

app.get("/signin", (req, res) => {
    var userCookie = req.cookies["userCookie"];
    
    if (userCookie == null) {
        res.render("signin");
    } else {
        return res.redirect("/")
    }
});

app.get("/signup", (req, res) => {
    var userCookie = req.cookies["userCookie"];

    if (userCookie == null) {
        res.render("signup");
    } else {
        return res.redirect("/");
    }
});

app.get("/404", (req, res) => {
    res.render("404");
});

app.post("/api/login", (req, res) => {
    var user = connection.getDoc("users", req.body.username);

    if (req.body.password == user.data.password) {
        res.cookie("userCookie", {username: user.data.username, token: user.data.token}, {
            maxAge: 86400 * 1000,
            httpOnly: true,
            secure: true
        });
        return res.redirect("/");
    }

    return res.redirect("/signin");
});

app.post("/api/register", (req, res) => {
    connection.createDoc("users", req.body.username, {
        email: req.body.email,
        username: req.body.username,
        password: req.body.password,
        token: crypto.randomBytes(16).toString("base64url")
    });

    return res.redirect("/");
});

app.post("/api/uploadfile", (req, res) => {
    var userCookie = req.cookies["userCookie"];
    var id = crypto.randomBytes(16).toString("base64url");

    if (userCookie == null) {
        userCookie = false;
    }

    const form = new formidable.IncomingForm();

    form.parse(req, function(err, fields, files){
        var oldPath = files.file.filepath;
        var newPath = path.join(__dirname, "/public/files/") + id + "/" + files.file.originalFilename;
        var rawData = fs.readFileSync(oldPath);

        fs.mkdirSync(path.join(__dirname, "/public/files/") + id);
      
        fs.writeFile(newPath, rawData, function (err) {
            if(err) console.log(err);
            return;
        });

        connection.createDoc("files", id, {
            id: id,
            user: userCookie.username,
            file: files.file.originalFilename,
            content_type: files.file.mimetype
        });
    });
    
    return res.redirect("/file/" + id);
});

app.listen(port);