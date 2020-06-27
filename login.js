var socketio = io.connect();
var myUid;
var callback_get_mediaDevice = [];

const LOG = function (msg) {
    if (typeof msg == "string") {
        var log_msg = {
            id: myUid,
            text: msg
        }
    } else {
        var log_msg = {
            id: myUid,
            text: JSON.stringify(msg, null, "\t")
        }
    }
    socketio.emit("log", JSON.stringify(log_msg));
    console.log(msg);
}

const getUniqueStr = function (myStrong) {
    var strong = 10;
    if (myStrong) strong = myStrong;
    return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16)
}
  
// // myUid = login();
// myUid = getUniqueStr();
// document.getElementById("myUid").innerText = myUid;

// var user_name = null;
// var group_id = null;

// const $login_btn = document.getElementById("login_btn");
// $login_btn.addEventListener("click", function(ev){
//     user_name = document.login_form.user_name;
//     group_id = document.login_form.group_id;
// })


// const init_user_id = "initial_user_id";
// const login = function () {
//     if (init_user_id == "initial_user_id") {
//         return getUniqueStr();
//     } else {
//         return init_user_id;
//     }
// }
  

// var input_name = function () {
//     var $input_name = document.getElementById("input_name");
//     var $name_ok_btn = document.getElementById("name_ok_btn");
//     var $name = document.getElementById("name");
//     var $group = document.getElementById("group_id");

//     $input_name.style.display = "block";
//     var input_name_change = function () {
//         if ($name.value != "") {
//             user_name = $name.value;
//             document.getElementById("myUid").innerText = user_name;
//         } else {
//             user_name = myUid;
//         }
//         group_id = $group.value;
//         $input_name.style.display = "none";
//     }
//     $name_ok_btn.addEventListener("click", input_name_change);
//     $input_name.addEventListener("keydown", function (e) {
//         if (e.keyCode == 13) input_name_change();
//     });

// }
// input_name();
