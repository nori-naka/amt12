const options = {
    //videoBitsPerSecond: 512000, // 512kbps
    mimeType: 'video/webm; codecs=vp9'
};


const upload = function (json_data) {
    socketio.emit("file", JSON.stringify(json_data));
}
const post_url = "/upload";
const post_file = function (file_name, b64) {
    let formData = new FormData();
    formData.append("data", b64, file_name);

    console.log(`post_fiel:file_name=${file_name}`);

    fetch(post_url, {
        method: "post",
        mode: "no-cors",
        body: formData
    })
        .then(response => {
            if (response.status == 200) {
                console.log(response);
            } else {
                alert("ファイルの転送に失敗しました。再度地点メモの登録をお願いします。");
                return;
            }
        })
        .catch(error => console.log(error.message));
}
const toBlob = function (base64, myType) {
    // Base64からバイナリへ変換
    var bin = atob(base64.replace(/^.*,/, ""));
    var buffer = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) {
        buffer[i] = bin.charCodeAt(i);
    }
    // Blobを作成
    var blob = new Blob([buffer.buffer], { type: myType });
    return blob;
};

const Record = function (stream, id) {

    this.blobUrl = null;
    let chunks = [];

    this.recorder = new MediaRecorder(stream);
    this.recorder.ondataavailable = ev => {
        chunks.push(ev.data);
    }
    this.recorder.onstart = ev => { if (this.callback.start) this.callback.start() };
    this.recorder.onstop = ev => {
        if (this.callback.stop) this.callback.stop();
        if (this.callback.error) this.callback.error();
        if (this.callback.pause) this.callback.pause();

        try {
            const file_name = `${users[id].name}_${Date.now()}.webm`;
            const blob = new Blob(chunks, { type: "video/webm" });
            upload({
                user_name: users[id].name,
                group_id: group_id, // add 20191116
                name: file_name,
                lat: users[id].lat,
                lng: users[id].lng,
                date: new Date().toLocaleString(),
                type: "video"
            });
            post_file(file_name, blob);

        } catch (err) {
            LOG(`Record ERROR = ${err}`);
            this.recorder.stop();
            // this.$start_btn.innerText = "REC";
            throw err;
        }
        chunks = [];
    }
    this.start = () => {this.recorder.start()};
    this.stop = () => { this.recorder.stop() };
    
    // ---------------CALLBACK -------------------------
    // handler_name = "start" / "stop" / "pause" / "error"
    this.callback = {};
    this.on = (handler_name, handler) => this.callback[handler_name] = handler;
}
