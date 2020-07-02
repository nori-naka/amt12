// Version 20.04.20
//
// p2p.js
// <<使い方>>
//
// import {P2P} from "./P2P.js";    /* モジュールのインポート (MUST)*/
// const peer = new P2P({           /* P2Pインスタンスの生成 */
//     my_id: my_id,　　　　　　     /* 自分のID (MUST)*/
//     remote_id: remote_id,        /* 対向先のID (MUST) */
//     group_id: group_id           /* グループID (デフォルト値: g1) (MUST) */
//     direction: direction,        /* 方向 sendonly | recvonly | sendrecv (option)*/
//     stream: stream,　　　　     　/* 自デバイスのstream (option)*/
//     options: options,            /* 別途iceサーバを使用する場合に指定する(option) */
// });
// peer.call_in();　                 /* 発呼 */
// peer.call_out();                  /* 切断 */
// peer.on("call_in", (stream) => {  /* 他デバイスのstream */
//     /* ここで着信時の処理*/
// });
// peer.on("call_out", (stream) = {  /* 他デバイスのstream */
//     /* ここで、切断時の処理 */
// }
// local_streamはグローバル変数として取得出来る事が前提になっている。

export function P2P(args) {
  this.name = args.name;
  //--------------------------------------------------
  // LOG
  //--------------------------------------------------
  const self = this;
  this.LOG = function (title, s, style) {
    // const NO_DISP = ["OFFER", "ANSWER", "ICE"]
    const NO_DISP = [];
    if (NO_DISP.includes(title)) return;

    if (style) {
      console.log(`${self.my_id} : ${title}: %c${s}`, style, "");
    } else {
      console.log(`${self.my_id} : ${title}: ${s}`);
    }
  };
  //--------------------------------------------------
  // Setting
  //--------------------------------------------------
  const options = args.options || {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  };

  if (!args.my_id || !args.remote_id) {
    throw new Error("missing setting(args.XXX)");
  }

  this.closed = false;
  this.my_id = args.my_id;
  this.remote_id = args.remote_id;
  this.group_id = args.group_id || "g1";
  this.stream = args.stream;
  this.direction = args.direction;

  //--------------------------------------------------
  // PeerConnection
  //--------------------------------------------------
  this.pc = new RTCPeerConnection(options);

  //--------------------------------------------------
  // destroy
  //--------------------------------------------------
  this.close = () => {
    // this.pc.close();
    // this.addTrack = null;
    this.pc.onicecandidate = null;
    this.pc.onsignalingstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.ontrack = null;
    this.call_in = null;
    this.call_out = null;
    this.callback = null;
    this.on = null;
    this.offer_addTrack = null;
    this.answer_addTrack = null;
    this.LOG = null;
    this.pc = null;
    this.closed = true;
    this.my_id = null;
    this.remote_id = null;
    this.group_id = null;
    this.stream = null;
    this.direction = null;
  };

  //--------------------------------------------------
  // setStream
  //--------------------------------------------------
  this.setStream = stream => {
    this.stream = stream;
  };

  //--------------------------------------------------
  //  local_stream -> video_track -(addTrack)-> 
  //               -> audio_track -(addTrack)-> 
  //
  //  (ontrack)-> ev.track -> new MediaStream([track])
  //--------------------------------------------------

  //--------------------------------------------------
  //      LOCAL     track  REMOTE
  //  (1) recvonly  <----  sendonly
  //  (2) sendonly  ---->  recvonly
  //  (3) sendrecv  <--->  sendrecv
  //
  //                       LOCAL            REMOTE
  //                       local_dir        offer_dir
  //  (1) CMD(recvonly) => recvonly  <----  sendonly
  //  (1) CMD(sendonly) => sendrecv  <--->  sendrecv
  //  (1) CMD(STOP)     => recvonly  <-X->  recvonly ★
  //  (2) CMD(recvonly) => sendrecv  <--->  sendrecv
  //  (2) CMD(sendonly) => sendonly  ---->  recvonly
  //  (3) CMD(recvonly) => recvonly  <----  sendonly
  //  (3) CMD(sendonly) => sendonly  ---->  recvonly
  //  (3) CMD(STOP)     => sendonly  ---->  recvonly ★ 
  //
  //  STOP: local_dir recvonly => recvonly
  //        local_dir sendrecv => sendonly
  //
  //--------------------------------------------------


  this.addTrack = (stream, type, local_direction) => {
    return new Promise((resolve, reject) => {
      const track = type == "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

      const transceivers = this.pc.getTransceivers();
      const trcv = transceivers.find(transceiver => {
        if (transceiver.receiver.track && transceiver.receiver.track.kind == type) return true;
        else if (transceiver.sender.track && transceiver.sender.track.kind == type) return true;
        // else if (!transceiver.sender.track) return true;
        else return false;
      });
      if (trcv) {
        // ------------------------- AUDIO ------------------------
        if (type == "audio") {
          if (local_direction == "recvonly" ||
            // local_direction == "LOCAL_STOP" ||
            local_direction == "REMOTE_STOP") {
            trcv.direction = "recvonly";
            trcv.sender.replaceTrack(null);
          } else if (local_direction == "LOCAL_STOP") {
            trcv.direction = "recvonly";
            this.pc.removeTrack(trcv.sender);
          } else if (local_direction == "sendonly") {
            trcv.direction = "sendonly";
            trcv.sender.replaceTrack(track);
          }
        } else {
          // ------------------------- VIDEO ------------------------
          if (local_direction == "LOCAL_STOP") {
            if (trcv.currentDirection == "recvonly") {
              trcv.direction = "recvonly";
              trcv.sender.replaceTrack(null);
            } else if (trcv.currentDirection == "sendrecv") {
              trcv.direction = "sendonly";
              trcv.sender.replaceTrack(track);
            }
          } else if (local_direction == "REMOTE_STOP") {
            trcv.direction = "recvonly";
            trcv.sender.replaceTrack(null);
          } else if (local_direction == "recvonly" &&
            (trcv.currentDirection == "recvonly" || trcv.currentDirection == "inactive")) {
            trcv.direction = "recvonly";
            trcv.sender.replaceTrack(null);
          } else if (local_direction == "sendonly" && trcv.currentDirection == "sendonly") {
            trcv.direction = "sendonly";
            trcv.sender.replaceTrack(track);
          } else {
            trcv.direction = "sendrecv";
            trcv.sender.replaceTrack(track);
          }
        }
      } else {
        const sender = this.pc.addTrack(track, stream);
        const trcv = this.pc.getTransceivers().find(tr => { return tr.sender === sender });
        trcv.direction = local_direction;
      }
      resolve();
    });
  }

  this.pc.onicecandidate = ev => {
    if (ev.candidate) {
      const data = {
        dest: this.remote_id,
        src: this.my_id,
        type: "candidate",
        candidate: ev.candidate
      };
      // this.LOG("ICE", JSON.stringify(data));
      this.LOG("ICE", `SEND to ${data.dest}`);
      this.send_msg( JSON.stringify(data));
    }
  };
  this.pc.onsignalingstatechange = () => {
    if (this.pc) {
      this.LOG("SIGNAL", this.pc.signalingState);
    } else {
      console.dir(this);
    }
  };
  this.pc.oniceconnectionstatechange = () => {
    this.LOG("CONNECT", this.pc.iceConnectionState)
  };

  // ----------------------- シグナリング送信処理 -------------------------
  this.send_msg = msg => {
    this.callback.send_msg(msg);
  };

  // ----------------------- シグナリング着信時処理 -----------------------

  this.recv_msg = async msg => {
    if (this.closed) return;

    const data = JSON.parse(msg);
    if (!(data.src == this.remote_id && data.dest == this.my_id)) {
      return;
    }

    if (data.type == "offer") {
      // this.LOG("着信OFFER", msg);
      if (!this.pc || this.pc.signalingState != "stable") return;

      await this.pc.setRemoteDescription(data);
      await this.addTrack(local_stream, data.media, data.direction);
      await this.pc
        .createAnswer()
        .then(answer => this.pc.setLocalDescription(answer));
      const _data = {
        dest: this.remote_id,
        src: this.my_id,
        type: "answer",
        sdp: this.pc.localDescription.sdp
      };
      this.send_msg( JSON.stringify(_data));
      this.LOG("SDP", `応答SEND to ${_data.dest}`);
    } else if (data.type == "answer") {
      // this.LOG("着信ANSWER", msg);
      if (this.pc.signalingState != "have-local-offer") return;
      await this.pc.setRemoteDescription(data);
    } else if (data.type == "candidate") {
      // this.LOG("着信ICE", msg);
      try {
        await this.pc.addIceCandidate(data.candidate);
      } catch (err) {
        this.LOG("ERR", `CANDIDATE ERRO=${err}`);
      }
    }
  };

  //--------------------------------------------------
  // offer_direction
  // ローカルのdirection内容によって、オファーするdirectionを決める
  //--------------------------------------------------
  this.offer_direction = local_direction => {
    if (local_direction == "sendrecv") return "sendrecv";
    else if (local_direction == "sendonly") return "recvonly";
    else if (local_direction == "recvonly") return "sendonly";
    else return "inactive";
  };

  //--------------------------------------------------
  // メディア発呼（ネゴ有り）
  //--------------------------------------------------
  this.call_in = async (local_direction, media_type) => {
    console.log(
      `---------CALL_IN:${this.my_id} > ${this.remote_id}------------------`
    );

    this.addTrack(local_stream, media_type, local_direction);
    await this.pc
      .createOffer()
      .then(offer => this.pc.setLocalDescription(offer));
    const data = {
      dest: this.remote_id,
      src: this.my_id,
      type: "offer",
      media: media_type,
      direction: this.offer_direction(local_direction),
      sdp: this.pc.localDescription.sdp
    };
    // this.LOG("LOCAL SDP", JSON.stringify(data));
    this.LOG("SDP", `発呼SEND to ${data.dest}`);
    this.send_msg( JSON.stringify(data));
  };

  //--------------------------------------------------
  // メディア切断（ネゴ有り）
  //--------------------------------------------------
  this.call_out = async (media_type) => {
    console.log(
      `---------CALL_OUT:${this.my_id} > ${this.remote_id}:------------------`
    );

    this.addTrack(local_stream, media_type, "LOCAL_STOP");
    await this.pc
      .createOffer()
      .then(offer => this.pc.setLocalDescription(offer));
    const data = {
      dest: this.remote_id,
      src: this.my_id,
      type: "offer",
      media: media_type,
      direction: "REMOTE_STOP",
      sdp: this.pc.localDescription.sdp
    };
    // this.LOG("LOCAL SDP", JSON.stringify(data));
    this.LOG("SDP", `切断SEND to ${data.dest}`);
    this.send_msg( JSON.stringify(data));
  }

  //--------------------------------------------------
  // メディア切断（ネゴ無し・強制）
  //--------------------------------------------------
  this.call_out_force = (media_type) => {
    console.log(
      `---------CALL_OUT FORCE:${this.my_id} > ${this.remote_id}:------------------`
    );

    this.pc.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind == media_type) {
        this.pc.removeTrack(sender);
      }
    })
  }

  // ---------------------------- CALL BACK --------------------------------
  // callback　イベントハンドラ
  // peer.on("call_in", handler(stream) { /* 接続時の処理*/ })
  // peer.on("call_out", handler() { /* 切断時の処理 */ })

  this.callback = {};
  this.on = (key, func_name) => {
    this.callback[key] = func_name;
  };
  this.last_stream;
  this.pc.ontrack = ev => {
    this.LOG(
      "CALL_IN",
      `ev.track.kind=${ev.track.kind} muted=${ev.track.muted}`,
      "color: blue; font-size: large;"
    );
    this.callback.call_in(new MediaStream([ev.track]));
    ev.track.onmute = () => {
      if (this.callback && this.callback.call_out) this.callback.call_out(new MediaStream([ev.track]));
      ev.track.onmute = null;
    }
  };
}

// <<使い方>>
//
// import {getStream} from "./P2P.js"; /* モジュールのインポート */
// const stream = getStream (          /* 返値:MediaStream */
//     elm,            　　　　　　     /* MediaStreamを表示するvideo要素 or audio要素 */
//     mConstruction,                  /* 制約(デフォルト値: {video:true, audio:true}) */
// );

export async function getStream(elm, mConstruction) {
  const construction = mConstruction || {
    video: true,
    audio: true
  };
  const stream = await navigator.mediaDevices.getUserMedia(construction);
  if (elm) {
    elm.srcObject = stream;
    await elm.play();
    elm.style = "display: block";
  }
  return stream;
}

// <<使い方>>
//
// import {getDeviceId} from "./P2P.js"; /* モジュールのインポート */
// const devices = getDeviceId ()       /* 返値:デバイスID */
// devices = {
//     audio: [device_id1, device_id2...], 
//     video: [device_id1, device_id2...] 
// }
export async function getDeviceId() {
  const devices = { audio: [], video: [] };
  const enum_list = await navigator.mediaDevices.enumerateDevices();
  enum_list.forEach(device => {
    if (device.kind == "videoinput") {
      devices.video.push(device.deviceId);
    } else if (device.kind == "audioinput" || device.kind == "audiooutput") {
      devices.audio.push(device.deviceId);
    }
  })
  return devices;
}

export async function getDesktopStream(elm, mConstruction) {
  const construction = mConstruction || {
    video: { displaySurface: "application" },
    audio: false
  };
  elm.style = "display: none";
  const stream = await navigator.mediaDevices.getDisplayMedia(construction);
  if (elm) {
    elm.srcObject = stream;
    await elm.play();
    elm.style = "display: block";
  }
  return stream;
}

// <<使い方>>
//
// import {stats} from "./P2P.js";     /* モジュールのインポート */
// stats (                             /* 返値:無し */
//     pc,                             /* ステータスを取得する対象:PeerConnection */
//     elm,            　　　　　　     /* 結果を表示するdiv要素相当 */
// );

export function stats(pc, elm) {
  this.timerId = setInterval(function () {
    pc.getStats(null).then(stats => {
      let statsOutput = "";

      stats.forEach(report => {
        statsOutput +=
          `<h2>Report: ${report.type}</h3>\n<strong>ID:</strong> ${report.id}<br>\n` +
          `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`;

        // Now the statistics for this report; we intentially drop the ones we
        // sorted to the top above

        Object.keys(report).forEach(statName => {
          if (
            statName !== "id" &&
            statName !== "timestamp" &&
            statName !== "type"
          ) {
            statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
          }
        });
      });

      elm.innerHTML = statsOutput;
    });
  }, 1000);
  this.clear = () => {
    clearInterval(this.timerId);
  };
}
