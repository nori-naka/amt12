
const $my_video = document.getElementById("my_video");
const $your_video = document.getElementById("your_video");
const isIOS = /[ \(]iP/.test(navigator.userAgent)

let peer = null;
let local_stream = null;
let is_serv_connectivity = true;

//-------------------------------------------------------------------------------
// peers = {
//     id: {
//         peer: PeerConnection,
//         video_elm: video_HTML_element,
//         audio_elm: audio_HTML_element
//     },
// }    
// let peers = {};

//-------------------------------------------------------------------------------
let test_constraints = {
    video: true,
    audio: true
    // audio: false
}

//-------------------------------------------------------------------------------
const constraints = {
    video: {
        deviceId: null,
        // facingMode: "user",
        // facingMode: "environment",
        width: 640,
        // height: 480,
        frameRate: { min: 1, max: 10 },
    },
    audio: true
    // audio: false
};

const regist = function (id, group_id) {
    LOG(`REGIST: myUid=${id} / group_id=${group_id}`)
    socketio.emit("regist", JSON.stringify({
        id: id,
        group_id: group_id
    }));
}

const dev_ids = [];
const enu_devices = function () {
    navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {
            devices.forEach(function (dev_info) {
                console.log(dev_info);
                if (dev_info.kind == "videoinput") {
                    dev_ids.push(dev_info.deviceId);
                }
            });
        })
        .catch(function (err) {
            console.log(`enu: error = ${err}`);
        })
}
enu_devices();

const next_constraints = function () {
    let dev_id = dev_ids.shift();
    dev_ids.push(dev_id);
    return {
        video: {
            deviceId: dev_id,
            width: 640,
            frameRate: { min: 1, max: 10 },
        },
        audio: true
    };
}

const create_my_video_start = function () {

    let dev_ids = [];
    let dev_id;
    // let constraints = {};

    return function () {
        // 最初にカメラデバイスのリストを作成する。
        if (dev_ids.length == 0) {
            navigator.mediaDevices.enumerateDevices()
                .then(function (devices) {
                    devices.forEach(function (dev_info) {
                        console.log(dev_info);
                        if (dev_info.kind == "videoinput") {
                            dev_ids.push(dev_info.deviceId);
                        }
                    });
                })
                .then(function () {
                    dev_id = dev_ids.shift()
                    dev_ids.push(dev_id);
                    // constraints = {
                    //     video: {
                    //         deviceId: dev_id,
                    //         width: 640,
                    //         frameRate: { min: 1, max: 10 },
                    //     },
                    //     audio: true
                    // };
                    constraints.video.deviceId = dev_id
                    navigator.mediaDevices.getUserMedia(constraints)
                        .then(function (stream) {

                            local_stream = stream;
                            $my_video.srcObject = local_stream;

                            dev_id = dev_ids.shift()
                            dev_ids.push(dev_id);
                            constraints.video.deviceId = dev_id;

                            return $my_video.play();
                        })
                        .then(function () {
                            if (callback_get_mediaDevice["RECORD_reg"]) {
                                callback_get_mediaDevice["RECORD_reg"]();
                            }
                        })
                        .catch(function (err) {
                            console.log("An error occurred: " + err);
                        });
                })
                .catch(function (err) {
                    console.log(`enu: error = ${err}`);
                })
        } else {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(function (stream) {

                    local_stream = stream;
                    $my_video.srcObject = local_stream;

                    dev_id = dev_ids.shift()
                    dev_ids.push(dev_id);
                    constraints.video.deviceId = dev_id;

                    return $my_video.play();
                })
                .then(function () {
                    if (callback_get_mediaDevice["RECORD_reg"]) {
                        callback_get_mediaDevice["RECORD_reg"]();
                    }
                    if (callback_get_mediaDevice["toggle_video"]) {
                        callback_get_mediaDevice["toggle_video"]();
                    }
                })
                .catch(function (err) {
                    console.log("An error occurred: " + err);
                });
        }
    }
}
const my_video_start = create_my_video_start();


$my_video.addEventListener("click", function (ev) {

    if ($my_video.srcObject) {
        // 自分の見ているvideoを停止させる。
        $my_video.srcObject.getVideoTracks().forEach(function (track) {
            track.stop();
        })
    }

    // if (constraints == user_constraints) {
    //     constraints = hide_constraints;
    // } else {
    //     constraints = user_constraints;
    // }
    // my_video_start(constraints);
    my_video_start(next_constraints());
})


const createPeerConnection = function (remote_id) {
    peer = new RTCPeerConnection({
        //sdpSemantics: "unified-plan",
        sdpSemantics: "plan-b",
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ]
    });

    peer.onicecandidate = on_icecandidate(remote_id);
    peer.ontrack = on_track(remote_id);
    peer.onnegotiationneeded = on_negotiationneeded(remote_id);
    peer.onremovetrack = on_removetrack;
    peer.onremovestream = on_removestream;
    peer.oniceconnectionstatechange = on_iceconnectionstatechange(remote_id);
    peer.onicegatheringstatechange = on_icegatheringstatechange;
    peer.onsignalingstatechange = on_signalingstatechange(remote_id);
    peer.onconnectionstatechange = on_connectionstatechange(remote_id);

    return peer;
}

const on_icecandidate = function (remote_id) {
    return function (ev) {

        if (!ev.candidate) {
            LOG(`${myUid}: END candidate`);
        } else {
            LOG(`${myUid}: candidate ->${remote_id}`);
            socketio.emit("publish", JSON.stringify({
                type: "candidate",
                dest: remote_id,
                src: myUid,
                candidate: ev.candidate
            }));
        }
    };
}

const on_negotiationneeded = function (remote_id) {
    return function (ev) {

        const peer = ev.target;
        peer.createOffer()
            .then(function (offer) {
                return peer.setLocalDescription(offer);
            })
            .then(function () {
                LOG(`${myUid}: offer ->${remote_id}`);
                socketio.emit("publish", JSON.stringify({
                    type: "offer",
                    dest: remote_id,
                    src: myUid,
                    sdp: peer.localDescription
                }))
            })
    }
}

const on_track = function (remote_id) {
    return function (ev) {

        if (ev.track.kind == "video") {
            let media_elm = document.getElementById(`video_${remote_id}`);
            media_elm.srcObject = ev.streams[0];
            media_elm.classList.remove("no_display");
            media_elm.play();

            keep_cur_video_func('ontrack', remote_id);

            ev.streams[0].onremovetrack = function (ev) {
                media_elm.classList.add("no_display");
                keep_cur_video_func('onremovetrack', remote_id);
            }

        } else {
            let media_elm = document.getElementById(`audio_${remote_id}`);
            media_elm.srcObject = ev.streams[0];
            media_elm.play();

            const $mic_btn = document.getElementById("send_audio_to_all");
            $mic_btn.classList.add("green_background");

            ev.streams[0].onremovetrack = function (ev) {
                $mic_btn.classList.remove("green_background");
            }
        }
    }
}

// 予防線
// まれに、onremovetrackのイベントを拾えずに緑に成りっぱなしになるので、
// audio trackが無ければ、緑を消す。
setInterval(function () {
    const $mic_btn = document.getElementById("send_audio_to_all");
    let flag_no_audio = true;
    Object.keys(peers).forEach(function (remote_id) {

        // console.log(`REMOTE=${remote_id}`)

        if (!peers[remote_id].peer) return;

        peers[remote_id].peer.getReceivers().forEach(function (r) {

            if (r.track.kind == 'audio') {
                if ($mic_btn.classList.contains('green_background')) {
                    $mic_btn.classList.add('green_background');
                    flag_no_audio = false;
                    return;
                }
            }
        });
    })
    if (flag_no_audio) {
        $mic_btn.classList.remove("green_background")
    }
}, 1000)


// WHY! onremovetrack is not work!
const on_removetrack = function (ev) {
    // no operation
}

const on_removestream = function (ev) {

    const remote_peer = this;

    // 発火元を調べる
    let target_id = null;
    Object.keys(peers).forEach(function (id) {
        if (peers[id].peer === remote_peer) {
            target_id = id;
            return;
        }
    });

    LOG(`on removestream : ${target_id} -> ${myUid}`);

}

const on_connectionstatechange = function (remote_id) {

    return function (ev) {
        let peer = ev.target;
        LOG(`${myUid}: connection_state = ${peer.connectionState}`);

        switch (peer.connectionState) {
            case "closed":
            case "failed":
            case "disconnected":
                // closeVideoCall(remote_id);
                break;
        }
    }

}

// 何故か、こちらは発火しない。connectionStateChangeのみ発火する。
const on_iceconnectionstatechange = function (remote_id) {

    return function (ev) {
        let peer = ev.target;
        LOG(`${myUid}: iceconnectionState = ${peer.iceConnectionState}`);

        switch (peer.iceConnectionState) {
            case "closed":
            case "failed":
            case "disconnected":
                // closeVideoCall(remote_id);
                break;
        }
    }
}

const on_signalingstatechange = function (remote_id) {

    return function (ev) {
        let peer = ev.target;
        LOG(`${myUid}: signalingState = ${peer.signalingState}`);

        switch (peer.signalingState) {
            case "closed":
                // closeVideoCall(remote_id);
                break;
        }
    }
};

const on_icegatheringstatechange = function (ev) {
    let peer = ev.target;
    LOG(`${myUid}: iceGatheringState = ${peer.iceGatheringState}`);
};

const recive_offer = function (data) {

    is_serv_connectivity = true;

    if (!peers[data.src].peer) {
        peers[data.src].peer = createPeerConnection(data.src);
    }
    LOG(`${data.src} -> ${myUid}: recive offer`)

    const desc = new RTCSessionDescription(data.sdp);

    peers[data.src].peer.setRemoteDescription(desc).then(function () {
        return peers[data.src].peer.createAnswer();
    })
        .then(function (answer) {
            return peers[data.src].peer.setLocalDescription(answer);
        })
        .then(function () {
            socketio.emit("publish", JSON.stringify({
                type: "answer",
                dest: data.src,
                src: myUid,
                sdp: peers[data.src].peer.localDescription
            }))
        });
}

const recive_answer = function (data) {

    const desc = new RTCSessionDescription(data.sdp);
    LOG(`${data.src} -> ${myUid}: recive answer`)
    peers[data.src].peer.setRemoteDescription(desc)
        .catch(function (e) {
            LOG(`${myUid}: recive answer. but failed : ${e}`)
        });
}

const recive_icecandidate = function (data) {

    if (!data.candidate) {
        LOG(`${myUid}: END recive candidate`);
    } else {
        let candidate = new RTCIceCandidate(data.candidate);
        peers[data.src].peer.addIceCandidate(candidate)
            .catch(function (e) {
                LOG(`${myUid}: addIceCandidate failed I am sorry: ${e}`);
            });
    }
}

const recive_type = {
    "offer": recive_offer,
    "answer": recive_answer,
    "candidate": recive_icecandidate,
}

socketio.on("publish", function (msg) {
    const data = JSON.parse(msg);

    if (data.dest == myUid) {
        recive_type[data.type](data);
    }
});

// start着信により映像送信、または映像停止を行う
socketio.on("start", function (msg) {
    const data = JSON.parse(msg)

    if (data.src) {
        if (data.type == "start") {
            send_video_to(data.src);
        } else {
            stop_video_to(data.src);
        }
    }
});

// サーバと接続された
socketio.on("req-regist", function (msg) {
    console.log(`recive req-regist : ${msg}`);
    regist(myUid, group_id);
    if (modalArea.classList.contains("is-show")) {
        modalArea.classList.remove('is-show');
    }
    is_serv_connectivity = true;
    // keep_cur_video_func('connect');
})

socketio.on("reconnect_failed", function (msg) {

    show_modal("AirMultiTalk", "サーバから切断されました\n初期化します");

    keep_cur_video_func('disconnect');
    Object.keys(peers).forEach(function (id) {
        closeVideoCall(id);
    })
    is_serv_connectivity = false;
})

const reportError = function (err) {
    console.log(`ERROR : ${err}`);
    LOG(`ERROR : ${err}`);
}

function closeVideoCall(remote_id) {
    LOG(`CLOSE : ${remote_id}`)
    console.trace();

    if (peers[remote_id] && peers[remote_id].peer) {
        peers[remote_id].peer.ontrack = null;
        peers[remote_id].peer.onremovetrack = null;
        peers[remote_id].peer.onremovestream = null;
        peers[remote_id].peer.onicecandidate = null;
        peers[remote_id].peer.oniceconnectionstatechange = null;
        peers[remote_id].peer.onsignalingstatechange = null;
        peers[remote_id].peer.onicegatheringstatechange = null;
        peers[remote_id].peer.onnegotiationneeded = null;

        const remoteVideo = document.getElementById(`video_${remote_id}`);
        if (remoteVideo.srcObject) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        peers[remote_id].peer.close();
        // peers[remote_id].peer = null;
        delete peers[remote_id].peer;

        remoteVideo.removeAttribute("src");
        remoteVideo.removeAttribute("srcObject");
    }

}

// リモート先にstartを送信して映像開始、停止を要求する。
const call_video = function (call_type, remote_id) {
    socketio.emit("start", JSON.stringify({
        type: call_type,
        dest: remote_id,
        src: myUid,
    }));
}

// リモート全ての映像送信を停止させ、送信していたリモートidを保管しておく、

const keep_cur_video = function () {

    let cur_video_ids = [];
    let state_hide = false;

    // on_state
    //   ontrack         接続されたremote_idを保存する。
    // 　onremovetrack   解除されたremote_idを削除する。
    //   disconnect      サーバからの接続断時、保存されたremote_idの接続を解除する。
    //   connect         サーバとの接続時、保存されたremote_idの接続を行う。
    return function (on_state, on_id) {

        switch (on_state) {
            case 'ontrack':
                if (!cur_video_ids.includes(on_id)) {
                    cur_video_ids.push(on_id);
                }
                break;
            case 'onremovetrack':
                if (!state_hide) {
                    cur_video_ids = cur_video_ids.filter(id => on_id !== id);
                }
                break;

            case 'onhide':
                state_hide = true;
            case 'disconnect':
                cur_video_ids.forEach(id => {
                    call_video("end", id);
                });
                break;

            case 'onshow':
                state_hide = false;
            case 'connect':
                cur_video_ids.forEach(id => {
                    call_video("start", id);
                });
                break;
        }
    }
}
const keep_cur_video_func = keep_cur_video();

const hide_video_all = function () {

    const receiving_video_ids = [];

    return function (hide) {

        if (hide) {

            Object.keys(peers).forEach(function (remote_id) {
                let now_receiving = false;
                if (peers[remote_id].peer) {
                    peers[remote_id].peer.getReceivers().forEach(function (receiver) {
                        if (receiver.track && receiver.track.kind == "video") {
                            now_receiving = true;
                            return;
                        }
                    });
                }
                if (now_receiving) {
                    call_video("end", remote_id);
                    // closeVideoCall(remote_id);
                    receiving_video_ids.push(remote_id);
                }
            });
        } else {

            while (remote_id = receiving_video_ids.shift()) {
                if (peers[remote_id]) {
                    call_video("start", remote_id);
                }
            }
        }
    }
}
const hide_video_all_func = hide_video_all();


// リモート先への映像送信を開始する
const send_video_to = function (remote_id) {

    if (!peers[remote_id].peer) {
        peers[remote_id].peer = createPeerConnection(remote_id);
    }
    local_stream.getVideoTracks().forEach(function (track) {

        // 既に送信中の場合には、send_video_toを呼ばれても、addTrackしない。
        let now_sending_video = false;
        peers[remote_id].peer.getSenders().forEach(function (sender) {
            if (sender.track && sender.track.kind == "video") {
                now_sending_video = true;
                return;
            }
        });
        if (!now_sending_video) {
            peers[remote_id].peer.addTrack(track);
        }
    })
}

// リモート先への映像送信を停止する。
const stop_video_to = function (remote_id) {

    const p = peers[remote_id].peer;
    p.getSenders().forEach(function (sender) {
        if (sender.track.kind == "video") {
            p.removeTrack(sender);
        }
    })
}

// const replace_video_to_all = function () {
//     local_stream.getVideoTracks().forEach(function (track) {

//         Object.keys(video_senders).forEach(function (id) {
//             video_senders[id].replaceTrack(track);
//         })
//     })
// }

// callback_get_mediaDevice["replace_video_to_all"] = function () {
//     local_stream.getVideoTracks().forEach(function (track) {

//         Object.keys(peers).forEach(function (id) {
//             const p = peers[id].peer;
//             p.getSenders().forEach(function (sender) {
//                 if (sender.track.kind == "video") {
//                     sender.replaceTrack(track);
//                 }
//             })
//         })
//         // Object.keys(video_senders).forEach(function (id) {
//         //     video_senders[id].replaceTrack(track);
//         // })
//     })
// }

const toggle_video = function () {
    local_stream.getVideoTracks().forEach(function (track) {

        Object.keys(peers).forEach(function (id) {
            peers[id].peer.getSenders().forEach(function (sender) {
                if (sender.track.kind == "video") {
                    sender.replaceTrack(track);
                }
            })
        })
    });
}
callback_get_mediaDevice["toggle_video"] = toggle_video;


const call_audio = function (remote_id) {

    if (!peers[remote_id].peer) {
        peers[remote_id].peer = createPeerConnection(remote_id);
    }
    local_stream.getAudioTracks().forEach(function (track) {
        LOG(track);
        peers[remote_id].peer.addTrack(track);
    })
}

// let cur_audio_senders = {};
// const send_audio_to_all = function () {

//     last_list.forEach(function (id) {
//         if (id != myUid) {
//             if (!peers[id].peer) {
//                 peers[id].peer = createPeerConnection(id);
//             }
//             local_stream.getAudioTracks().forEach(function (track) {
//                 LOG(`audio track ADD ${myUid}->${id}`);
//                 cur_audio_senders[id] = peers[id].peer.addTrack(track);
//             });
//         }
//     })
// }

// const stop_audio_to_all = function () {

//     Object.keys(cur_audio_senders).forEach(function (id) {
//         LOG(`audio track REMOVE ${myUid}->${id}`);
//         peers[id].peer.removeTrack(cur_audio_senders[id]);
//         delete cur_audio_senders[id];
//         LOG(`cur_audio_senders=${JSON.stringify(cur_audio_senders)}`);
//     })
// }


const send_audio_to_all = function () {

    Object.keys(peers).forEach(function (id) {

        if (id != myUid) {
            if (!peers[id].peer) {
                peers[id].peer = createPeerConnection(id);
            }
        }
        local_stream.getAudioTracks().forEach(function (track) {
            LOG(`audio track ADD ${myUid}->${id}`);
            peers[id].peer.addTrack(track);
        })
    })
}

const stop_audio_to_all = function () {

    Object.keys(peers).forEach(function (id) {

        const p = peers[id].peer;
        p.getSenders().forEach(function (sender) {
            if (sender.track.kind == "audio") {
                p.removeTrack(sender);
            }
        })

        LOG(`audio track REMOVE ${myUid}->${id}`);
    })
}

const stop_audio_to = function (id) {
    const p = peers[id].peer;
    p.getSenders().forEach(function (sender) {
        if (sender.track.kind == "audio") {
            p.removeTrack(sender);
        }
    })
}

const $mic_btn = document.getElementById("send_audio_to_all");
$mic_btn.addEventListener("touchstart", function (ev) {
    ev.preventDefault();

    $mic_btn.classList.add("red_background");
    send_audio_to_all();
})
$mic_btn.addEventListener("touchend", function (ev) {
    ev.preventDefault();

    $mic_btn.classList.remove("red_background");
    stop_audio_to_all()
})
$mic_btn.addEventListener("mousedown", function (ev) {
    $mic_btn.classList.add("red_background");
    send_audio_to_all();
})
$mic_btn.addEventListener("mouseup", function (ev) {
    $mic_btn.classList.remove("red_background");
    stop_audio_to_all()
})

regist(myUid, group_id);
// my_video_start(constraints);
