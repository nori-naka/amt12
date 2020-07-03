module.exports = function (server) {
    
    var io = require("socket.io").listen(server);
    var fs = require("fs");

    // ユーザ管理ハッシュ
    var userHash = {};
    var user_list = {};
    var user_sid = {};
    var user_gid = {};
    var allDraw = {};
    // 軌跡
    const tracks = {};
    const TRACK_LOG_LIMIT = 21600;

    const LOG = function (flag, msg) {
        if (!flag) return;
        console.log(`${new Date().toLocaleString()}:${msg}`);
        // console.dir(user_sid)
    }
    // LOG FLAG
    USER_LIST_LOG_FLAG = false;
    MSG_LOG_FLAG = false;
    SERVER_LOG_FLAG = false;

    var keepAliveStart = false;
    var ttlVal = 10;
    var keepAliveTime = (new Date()).getTime();

    var json_filename = "./RECORD_layer/position.json";
    var position_hash = {};
    try {
        var out_str = fs.readFileSync(json_filename, 'utf8')
        position_hash = JSON.parse(out_str)
    } catch (err) {
        console.log(err);
    }


    //-------------------------------------------------------------
    // userHash = {
    //   group_id1 : {
    //       id11 : { lat : lat11,  lng : lng11, ttl : ttl, name: name11},
    //       id12 : { lat : lat12,  lng : lng12, ttl : ttl, name: name12},
    //   },
    //   group_id2 : {
    //       id21 : { lat : lat21,  lng : lng21, ttl : ttl, name: name21},
    //       id22 : { lat : lat22,  lng : lng22, ttl : ttl, name: name22},
    //   }
    // }
    //-------------------------------------------------------------
    // user_list = {
    //   group_id1 : {
    //       id11 : { ttl : ttl, name: name11},
    //       id12 : { ttl : ttl, name: name12},
    //   },
    //   group_id2 : {
    //       id21 : { ttl : ttl, name: name21},
    //       id22 : { ttl : ttl, name: name22},
    //   }
    // }
    //-------------------------------------------------------------
    // user_sid = {
    //   group_id1 : {
    //       id1 : socket_id1,
    //       id2 : socket_id2,
    //   },
    // }
    //-------------------------------------------------------------
    // allDraw = {
    //   group_id1 : [
    //                 {
    //                    width :3,
    //                    color :"#000000",
    //                    coords:[[lat1,lng1],[lat2,lng2],[lat3,lng3]],
    //                 },
    //                 {
    //                    width :3,
    //                    color :"#000000",
    //                    coords:[[lat1,lng1],[lat2,lng2],[lat3,lng3]],
    //                 },
    //               ],
    //   group_id2 : [],
    // }

    var getUniqueStr = function (myStrong) {
        var strong = 10;
        if (myStrong) strong = myStrong;
        return new Date().getTime().toString(16) + Math.floor(strong * Math.random()).toString(16)
    }

    // イベントの定義
    io.on("connection", function (socket) {

        console.log(`----------------------CONNECTION=${socket.id}------------------`);
        // socket.to(socket.id).emit("req-regist", {});
        socket.emit("req-regist", "HELLO");


        // ログメッセージ
        socket.on("log", function (msg) {
            var data = JSON.parse(msg);
            console.log(`from=${data.id} // text=${data.text}`);
            // LOG(MSG_LOG_FLAG, `from=${data.id} // ${data.text}`);
        });

        // 登録
        socket.on("regist", function (msg) {
            var data = JSON.parse(msg);
            console.dir(msg)
            // console.log('ON REGIST:' + _id);
            LOG(USER_LIST_LOG_FLAG, `ON REGIST: ${data.id}@${data.group_id}`);
            _id = data.id;
            group_id = data.group_id;

            socket.join(group_id);

            user_sid[_id] = socket.id;
            user_gid[_id] = group_id;

            if (!userHash[group_id]) {
                userHash[group_id] = {};
            }

            console.log(`changed user_sid `);
            console.dir(user_sid);
            socket.broadcast.emit("regist", JSON.stringify({ id: _id }));//現在、誰も受信していない
            // socket.emit("alldraw", JSON.stringify(allDraw));
            io.to(group_id).emit("alldraw", JSON.stringify(allDraw[group_id]));
        });

        // P2P開始
        socket.on("start", function (msg) {
            var data = JSON.parse(msg);
            // console.log(`ON START: ${data.src} -> ${data.dest}  MSG=${msg}`);
            LOG(MSG_LOG_FLAG, `ON START: ${data.src} -> ${data.dest}  MSG=${msg}`);
            if (data.dest) {
                socket.to(user_sid[data.dest]).emit("start", msg);
            }
        });


        // position_hash = 
        // {
        //    XXXX: { "user_name": "xxx", "経度情報": "XXX", "緯度情報": "YYY", "年月日": "YYYY/MM/DD", "video": "/tmp/file_name.webm" },
        //    XXXY: { "user_name": "xxx", "経度情報": "XXX", "緯度情報": "YYY", "年月日": "YYYY/MM/DD", "video": "/tmp/file_name.webm" },
        // }

        // クライアントから送信されるデータ（画像データ含む）
        // {
        //     user_name: XXXXX,
        //     name: `${local_id}_${Date.now()}.webm`,  (video only)
        //     group_id: group_id,
        //     lat: position.lat,
        //     lng: position.lng,
        //     date: new Date().toLocaleString(),
        //     blob: b64, (video only)
        //     memo: XXX,  (memo only)
        //     delete: xxxx (delete only. xxxx is id)
        // }

        socket.on("file", function (msg) {

            // console.log(`FILE on ${msg}`);
            var data = JSON.parse(msg);

            if (data.delete) {
                delete position_hash[data.delete];

            } else if (data.type == "video") {
                console.log(`FILE=${data.name}`)
                // position_hash file save
                position_hash[getUniqueStr()] = {
                    "記録者": data.user_name,
                    "group_id": data.group_id, // add 20190813
                    "経度情報": data.lng,
                    "緯度情報": data.lat,
                    "年月日": data.date,
                    "video": "/tmp/" + data.name
                };

            } else {
                position_hash[getUniqueStr()] = {
                    "記録者": data.user_name,
                    "group_id": data.group_id, // add 20190813
                    "経度情報": data.lng,
                    "緯度情報": data.lat,
                    "年月日": data.date,
                    "memo": data.memo
                };
            }
            fs.writeFile(json_filename, JSON.stringify(position_hash),
                function (err) {
                    if (err) {
                        console.log(`socket.on_file: position_hash write err=${err}`);
                    } else {
                        console.log(`FILE WRITE SUCCESS : ${data.name}`)
                    }
                }
            )

        });


        // メッセージ送信
        socket.on("publish", function (msg) {
            var data = JSON.parse(msg);
            // if (data.dest) {
            //     //socket.broadcast.emit("publish", msg);
            //     socket.to(user_sid[data.dest]).emit("publish", msg);
            // } else {
            //     socket.broadcast.emit("publish", msg);
            // }
            socket.broadcast.emit("publish", msg);
            console.log(`PUBLISH MSG: ${msg}`);
            console.log(`-------------------------------------------------------------------------------`);
        });

        socket.on("video_off", (msg) => {
            const data = JSON.parse(msg);
            console.log(`VIDEO OFF ID=${data.id}`);
            socket.broadcast.emit("video_off", msg);
        })

        // PING
        socket.on("remote_connect", function (msg) {
            var data = JSON.parse(msg);

            // console.log(`remote_connect ${msg}`);
            if (data.dest) {
                socket.to(user_sid[data.dest]).emit("remote_connect", msg);
            }
        });


        // 位置情報着信
        socket.on("renew", function (msg) {
            var data = JSON.parse(msg);
            // console.log(`ON RENEW : From=${data.id} LAT=${data.lat} LNG=${data.lng} CAM=${data.cam} NAME=${data.name}`);
            LOG(USER_LIST_LOG_FLAG, `ON RENEW : From=${data.id} LAT=${data.lat} LNG=${data.lng} CAM=${data.cam} NAME=${data.name}`);

            if (data.id) {
                if (!userHash[user_gid[data.id]]) {
                    userHash[user_gid[data.id]] = {};
                }
                userHash[user_gid[data.id]][data.id] = {
                    // lat: data.lat, 
                    // lng: data.lng, 
                    // ttl: ttlVal, 
                    // cam: data.cam, 
                    // name: data.name 
                    lat: data.lat,
                    lng: data.lng,
                    heading: data.heading,
                    speed: data.speed,
                    timestamp: data.timestamp,
                    altitude: data.altitude,
                    accuracy: data.accuracy,
                    altitudeAccuracy: data.altitudeAccuracy,
                    ttl: ttlVal,
                    cam: data.cam,
                    name: data.name
                };
                //console.log("RECIVE:USERHASH=" + JSON.stringify(userHash));
                // 軌跡蓄積
                // そもそも緯度経度が計測出来ている時
                if (data.lat && data.lng) {
                    if (tracks[data.id]) {
                        // そもそも、tracks[id].coordsはある？
                        if (tracks[data.id].coords) {
                            const first_point = tracks[data.id].coords[0];
                            if (first_point[0] != data.lat || first_point[1] != data.lng) {
                                // 蓄積
                                tracks[data.id].coords.unshift([data.lat, data.lng]);
                                if (tracks[data.id].coords.length > TRACK_LOG_LIMIT) {
                                    tracks[data.id].coords.pop();
                                }
                            }
                            // const last_point = tracks[data.id].coords[tracks[data.id].coords.length - 1]
                            // // 最後の緯度経度と同じ場合（≒動いてない）は蓄積しない。
                            // // 最後の緯度経度
                            // // console.log(`最後の緯度経度=${last_point}`);
                            // // console.log(`受信した緯度経度=${[data.lat, data.lng]}`);
                            // if (last_point[0] != data.lat || last_point[1] != data.lng) {
                            //   // 蓄積
                            //   tracks[data.id].coords.push([data.lat, data.lng]);
                            //   // 蓄積上限に来たら、アタマから削除
                            //   if (tracks[data.id].coords.length > TRACK_LOG_LIMIT) {
                            //     tracks[data.id].coords.shift();
                            //   }
                            // }
                        } else {
                            tracks[data.id].coords = [[data.lat, data.lng]];
                        }
                    } else {
                        tracks[data.id] = { coords: [[data.lat, data.lng]] }
                    }
                }
                // console.log(`TRACK=${JSON.stringify(tracks)}`);
            }
        });

        // カメラ情報設定
        socket.on("camera", function (msg) {
            var data = JSON.parse(msg);
            // console.log(`ON CAMERA : ID=${data.id} CAM=${data.cam}`);

            if (data.id) {
                if (userHash[user_gid[data.id]][data.id]) {
                    userHash[user_gid[data.id]][data.id].cam = data.cam;
                    //userHash[data.id].cam = true;
                } else {
                    userHash[user_gid[data.id]][data.id] = { lat: null, lng: null, ttl: ttlVal, cam: data.cam, name: data.name };
                    //userHash[data.id] = { lat: null, lng: null, ttl: ttlVal, cam: true };
                }
            }
        });

        // 切断
        socket.on("disconnect", function (reason) {
            // console.log(`DISCONNECT msg=${reason}`);
            LOG(USER_LIST_LOG_FLAG, `DISCONNECT msg=${reason}`);
            console.log(`DISCONNECT socket.id=${socket.id}`);
            Object.keys(user_sid).forEach(function (_id) {
                if (user_sid[_id] == socket.id) {
                    if (user_gid[_id] && userHash[user_gid[_id]]) delete userHash[user_gid[_id]][_id];
                    if (user_gid[_id] && user_list[user_gid[_id]]) delete user_list[user_gid[_id]][_id];
                    if (user_gid[_id]) delete user_gid[_id];
                    if (user_sid[_id]) delete user_sid[_id];
                    io.sockets.emit("disconnected", JSON.stringify({ id: _id }));
                }
            });
        });

        // 接続終了(接続元ユーザを削除し、他ユーザへ通知)
        /*
        Object.keys(user_sid).forEach(function(_id){
            if (socket.id == user_sid[_id]) {
                delete userHash[_id];
                delete user_sid[_id];
                var msg = {id: _id};
                socket.broadcast.emit("disconect", JSON.stringify(msg));
            }
        });
        console.log("DELETE:USERHASH=" + JSON.stringify(userHash));        
        //socket.broadcast.emit("renew", { value: JSON.stringify(userHash) });   
        */

        // 軌跡描画データ送信
        socket.on("track", function (msg) {
            const data = JSON.parse(msg);
            // data = {user_id1: point_num1, user_id2: point_num2, ...user_id_N: point_num_N,}

            const send_track = {};

            // msgから要求されたユーザIDを抽出
            Object.keys(data).forEach(function (user_id) {
                if (!tracks[user_id] || !tracks[user_id].coords) return;

                // trackは最新が若番、最古が末尾になる。
                const point_num = data[user_id].point_num;
                const track_color = data[user_id].color;
                const track_group = data[user_id].group_id;
                // const track_len = tracks[user_id].coords.length;
                send_track[user_id] = {
                    width: 5,
                    color: track_color,
                    type: "LineString",
                    id: `track_${user_id}`,
                    // coords: tracks[user_id].coords.slice(track_len - point_num, track_len),
                    coords: tracks[user_id].coords.slice(0, point_num),
                    radius: null,
                    group: track_group
                };
            });
            // console.log(`SEND TRACK=${JSON.stringify(send_track)}`);
            socket.emit("track", JSON.stringify(send_track));
        });

        // 手書き
        socket.on("draw", function (jsonData) {
            // console.log("[DRAW]" + jsonData);
            // socket.broadcast.emit("draw", jsonData);

            const newData = JSON.parse(jsonData);
            socket.to(user_gid[newData.src]).emit("draw", jsonData);

            if (!allDraw[user_gid[newData.src]]) {
                allDraw[user_gid[newData.src]] = [];
            }
            allDraw[user_gid[newData.src]] = allDraw[user_gid[newData.src]].filter(data => data.id != newData.id);
            allDraw[user_gid[newData.src]].push(newData);
        })

        // socket.on("erase", function (id) {
        socket.on("erase", function (msg) {
            var _data = JSON.parse(msg);
            //console.log("[ERASE]" + id);
            // socket.broadcast.emit("erase", id);
            socket.to(user_gid[_data.src]).emit("erase", _data.id);
            allDraw[user_gid[_data.src]] = allDraw[user_gid[_data.src]].filter(data => data.id != _data.id);
        })


        // ユーザリスト
        socket.on("user_list", function (msg) {
            // console.log(`recive user_list=${msg}`)
            LOG(USER_LIST_LOG_FLAG, `recive user_list=${msg}`)
            var data = JSON.parse(msg);
            

            if (data.id) {
                user_sid[data.id] = socket.id;
                user_gid[data.id] = data.group_id;
                if (!user_list[data.group_id]) {
                    user_list[data.group_id] = {};
                }
                user_list[data.group_id][data.id] = { ttl: ttlVal, name: data.name };
            }
        });

        // setInterval(function () {
        //     console.log(`USER_LIST=${JSON.stringify(user_list)}`);
        //     io.emit("user_list", JSON.stringify(user_list));
        // }, 5000);

        // setInterval(function () {
        //     io.emit("renew", JSON.stringify(userHash));
        // }, 1500);

    });

    setInterval(function () {
        // console.log(`USER_LIST=${JSON.stringify(user_list)}`);
        LOG(USER_LIST_LOG_FLAG, `SEND USER_LIST=${JSON.stringify(user_list)}`);
        Object.keys(user_list).forEach(function (group_id) {
            io.to(group_id).emit("user_list", JSON.stringify(user_list[group_id]));
        });
    }, 1500);

    setInterval(function () {
        // io.emit("renew", JSON.stringify(userHash));
        Object.keys(userHash).forEach(function (group_id) {
            io.to(group_id).emit("renew", JSON.stringify(userHash[group_id]));
        });
    }, 1500);


    setInterval(function () {
        Object.keys(user_list).forEach(function (group_id) {
            Object.keys(user_list[group_id]).forEach(function (id) {
                user_list[group_id][id].ttl = user_list[group_id][id].ttl - 1;
                if (user_list[group_id][id].ttl < 0) {
                    delete user_list[group_id][id];
                    delete user_sid[id];
                    delete user_gid[id];
                    // console.log(`DELETE id=${id} USER_LIST=${JSON.stringify(user_list)}`);
                    LOG(USER_LIST_LOG_FLAG, `DELETE id=${id} USER_LIST=${JSON.stringify(user_list)} USER_SID=${JSON.stringify(user_sid)}`);
                }
            });
        });
    }, 1500);

    setInterval(function () {
        const now = (new Date()).getTime();
        if (now >= keepAliveTime + 1500) {
            keepAliveTime = now;
            Object.keys(userHash).forEach(function (group_id) {
                Object.keys(userHash[group_id]).forEach(function (id) {
                    userHash[group_id][id].ttl = userHash[group_id][id].ttl - 1;
                    if (userHash[group_id][id].ttl < 0) {
                        delete userHash[group_id][id];
                        //delete user_sid[id];
                        // console.log(`DELETE id=${id} USER_HASH=${JSON.stringify(userHash)}`);
                        LOG(USER_LIST_LOG_FLAG, `DELETE id=${id} USER_HASH=${JSON.stringify(userHash)}`);
                    }
                });
            })
        }
    }, 1500);



    // 番号をアルファベットに変換（27進数）
    function getAlphabet(no) {
        return getAlphabetExec(no + 1);
    }
    function getAlphabetExec(no) {
        if (no == 0) {
            return "";
        }
        else if (no < 27) {
            return String.fromCharCode(0x40 + no);
        }
        else {
            var upper = Math.floor(no / 27);
            var lower = no % 27;
            return getAlphabetExec(upper) + getAlphabetExec(lower);
        }
    }

    // ユニークID
    function getUniqueIdMaker() {
        var userId = 0;
        return function () {
            var alpha = getAlphabet(userId);
            userId++;
            return alpha;
        }
    }

    return null;
}