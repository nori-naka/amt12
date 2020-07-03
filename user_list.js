Vue.component("remote_user", {
    props: ["user", "remote_id", "init_width", "video_on_off"],
    template: `<div ref="video_container" :style="styleObj">
        <div v-on:click="video_call" class="text videoTitle">{{ user.name }}</div>
        <video
            v-show="show_video"
            ref="remote_video"
            class="video_elm"
            playsinline autoplay muted
            @mousedown.prevent="mdown"
            @mousemove.prevent="mmove"
            @mouseup.prevent="mup"
            @mouseleave.prevent="mup"
            @touchstart.prevent="mdown"
            @touchmove.prevent="mmove"
            @touchend.prevent="mup"
        ></video>
        <!--
        <audio ref="remote_audio"></audio>
        -->
        <div
            class="resize_grip"
            :style="gripStyleObj"
            @mousedown.prevent="rdown"
            @mousemove.prevent="rmove"
            @mouseup.prevent="rup"
            @touchstart.prevent="rdown"
            @touchmove.prevent="rmove"
            @touchend.prevent="rup"
        ></div>
    </div>`,
    data() {
        return {
            // socketio: io.connect(),
            peer: null,
            show_video: false,
            move_flag: false,
            move_once: false,
            focus_flag: false,
            resize_flag: false,
            clearId: {},
            top: 0,
            left: 0,
            last_pos: {}
        }
    },
    mounted() {
        import("./p2p.js").then(module => {
            // Requester
            this.peer = new module.P2P({        /* P2Pインスタンスの生成 */
                my_id: `${myUid}`,                  /* 自分のID (MUST)*/
                remote_id: `${this.remote_id}`,     /* 対向先のID (MUST) */
                group_id: this.user.group_id,       /* グループID (デフォルト値: g1) (MUST) */
                stream: local_stream,               /* 自デバイスのstream (option)*/
                // options: options,                /* 別途iceサーバを使用する場合に指定する(option) */
            });
            this.peer.on("call_in", async (stream) => {  /* 他デバイスのstream */

                const [track] = stream.getTracks()
                if (track.kind == "audio") {
                    console.log("ON CALL_IN AUDIO");
                    this.$emit("on_audio_call", true, stream);
                } else {
                    console.log("ON CALL_IN VIDEO");
                    this.$refs.remote_video.srcObject = stream;
                    await this.$refs.remote_video.play();
                    // this.show_video = true;
                }
            });
            this.peer.on("call_out", stream => {

                const [track] = stream.getTracks();

                if (track.kind == "audio") {
                    this.$emit("on_audio_call", false, null);
                }
            });

            this.peer.on("send_msg", msg => {
                this.$emit("send_msg", msg);
            })

            document.body.addEventListener("mousemove", this.rmove, false);
            document.body.addEventListener("mouseup", this.rup, false);
            document.body.addEventListener("touchend", this.rup, { passive: true });
        });
    },
    methods: {
        video_call() {
            if (this.show_video) {
                this.peer.call_out("video");
                this.show_video = false;
                // this.$refs.remote_video.classList.toggle("show_video_elm");
            } else {
                this.peer.call_in("recvonly", "video");
                this.show_video = true;
                // this.$refs.remote_video.classList.toggle("show_video_elm");
            }
            this.$emit("video_call", this.show_video, this.user.id);
        },
        change_local_stream() {
            this.peer.setStream(local_stream);
            this.peer.call_in("sendonly", "video");
        },
        // audio_call_in() {
        //     this.peer.call_in("sendonly", "audio");
        // },
        mdown(ev) {
            const _ev = ev.touches ? ev.touches[0] : ev;
            this.move_flag = true;
            this.move_once = true;
            this.top = this.$refs.video_container.offsetTop;
            this.left = this.$refs.video_container.offsetLeft;
            this.width = this.$refs.video_container.clientWidth;
            this.last_pos = { x: _ev.clientX, y: _ev.clientY };
            this.focus_flag = true;
            this.$emit("focus", this.remote_id);
        },
        mmove(ev) {
            if (this.move_flag) {
                const _ev = ev.touches ? ev.touches[0] : ev;
                this.top = this.top + (_ev.clientY - this.last_pos.y);
                this.left = this.left + (_ev.clientX - this.last_pos.x);
                this.$refs.video_container.style.width = this.width + "px";
                this.last_pos = { x: _ev.clientX, y: _ev.clientY };
            }
        },
        mup(ev) {
            this.move_flag = false;
        },
        rdown(ev) {
            const _ev = ev.touches ? ev.touches[0] : ev;
            this.resize_flag = true;
            this.width = this.$refs.video_container.clientWidth;
            this.last_pos = { x: _ev.clientX, y: _ev.clientY };
        },
        rmove(ev) {
            if (this.resize_flag) {
                const _ev = ev.touches ? ev.touches[0] : ev;
                this.width = this.width + (_ev.clientX - this.last_pos.x);
                this.$refs.video_container.style.width = this.width + "px";
                this.last_pos = { x: _ev.clientX, y: _ev.clientY };
            }
        },
        rup(ev) {
            this.resize_flag = false;
        },
        focus_in() {
            this.focus_flag = true;
        },
        focus_out() {
            this.focus_flag = false;
        }
    },
    computed: {
        styleObj() {
            if (!this.video_on_off) {
                this.move_once = false;
                this.top = 0;
                this.left = 0;
                this.$refs.video_container.style.width = this.init_width + "px";
            }
            return {
                position: this.move_once ? "absolute" : "relative",
                top: this.top + "px",
                left: this.left + "px",
                Opacity: this.move_flag ? 0.5 : 1,
                border: this.move_flag ? "4px solid #f00" : "0px",
                minWidth: "100px",
                backgroundColor: "#37a3c0",
                zIndex: this.focus_flag ? 1000 : 100,
                backgroundColor: this.focus_flag ? "#ffa2c0" : "#38a2c0"
            };
        },
        videoStyleObj() {
            return {
                width: "100%",
            };
        },
        gripStyleObj() {
            return {
                borderBottomColor: this.resize_flag ? "#c03838" : "#37a3c0"
            };
        }
    },
    beforeDestroy() {
        this.peer.call_out_force("audio");
        this.peer.call_out_force("video");
        this.peer.close();
        Object.keys(this.clearId).forEach(key => {clearInterval(this.clearId[key])})
        document.body.removeEventListener("mousemove", this.rmove, false);
        document.body.removeEventListener("mouseup", this.rup, false);
        document.body.removeEventListener("touchend", this.rup, { passive: true });
        // this.peer_res.close();
        // this.peer.close();
    }
})

var local_stream;
var app = new Vue({
    el: "#rtc",
    template: `
    <div>
        <div ref="localBox" id="localBox" class="box box_width">
            <div class="title_box">
                <div id="myUid" class="text title" @click="toggle_show_local_video">{{ my_name }}</div>
                <div class="rec_btn" id="rec_btn">REC</div>
            </div>
            <video v-show="show_local_video" ref="my_video" id="my_video" @click="video_start" class="video_width" playsinline autoplay muted></video>
        </div>
        <div ref="remoteBoxs" v-show="video_on_off" class="box box_width remoteBox">
            <remote_user
                ref="remote_users"
                v-for="user in users"
                :user="user"
                :remote_id="user.id"
                :key="user.id"
                :init_width="$refs.localBox.clientWidth"
                :video_on_off="video_on_off"
                @video_call="set_video_on_off"
                @focus="set_focus"
                @on_audio_call="on_audio_call"
                @send_msg="send_msg"
            >
            </remote_user>
            <audio ref="audio_elm"></audio>
        </div>
    </div>
    `,
    data: {
        users: [],
        devices: {},
        get_local_stream: null,
        get_devices: null,
        mic_btn_elm: document.getElementById("send_audio_to_all"),
        video_on_off_elm: document.getElementById("videoBtn"),
        audio_on_flag: false,
        constraints: {
            video: {
                width: 640,
                frameRate: { max: 10 },
                deviceId: null
            },
            audio: true
        },
        my_name: user_name ? `${user_name}@${group_id}` : myUid,
        cur_video_showed: {},
        show_local_video: true,
        video_on_off: true,
        TTL_VAL: 6,
        user_list_ttl: 6,
        clearId: {}
    },
    mounted() {
        import("./p2p.js").then(async module => {
            this.get_local_stream = module.getStream;
            this.get_devices = module.getDeviceId;

            this.video_start();
        });

        this.video_on_off_elm.addEventListener("click", () => {
            this.video_on_off = this.video_on_off ? false : true;
            if (this.video_on_off == false) {
                this.show_local_video = false;
                this.video_on_off_elm.style.backgroundColor = "rgba(169,169,169,0.7)";
                socketio.emit("video_off", JSON.stringify({ id: myUid }));
            } else {
                this.show_local_video = true;
                this.video_on_off_elm.style.backgroundColor = "#38a2c0"
            }
        }, false)

        this.$nextTick(() => {
            socketio.on("req-regist", (msg) => {
                console.log(`recive req-regist : ${msg}`);
                this.regist(myUid, group_id);
                if (modalArea.classList.contains("is-show")) {
                    modalArea.classList.remove('is-show');
                }
            });
            socketio.on("user_list", (msg) => {
                const data = JSON.parse(msg);
                LOG(`ON USER_LIST:${msg}`);

                delete data[myUid];
                this.users = Object.keys(data).map(id => {
                    return { id: id, ttl: data[id].ttl, name: data[id].name }
                });
                this.user_list_ttl = this.TTL_VAL;
            });
            socketio.on("disconnect", (msg) => {
                console.log(`ON DISCONNECT: ${msg}`);
                this.users = [];
                socketio.connect();
            });

            socketio.on("disconnected", (msg) => {
                const data = JSON.parse(msg);
                console.log(`ON DISCONNECTED by ${data.id}`);
            });

            socketio.on("publish", msg => {
                const data = JSON.parse(msg);

                const remote_user = this.$children.find(child => { return child.remote_id == data.src });
                if (remote_user) {
                    remote_user.peer.recv_msg(msg);
                }
            });
        })

        this.mic_btn_elm.addEventListener("touchstart", this.audio_start, false);
        this.mic_btn_elm.addEventListener("touchend", this.audio_stop, false);
        this.mic_btn_elm.addEventListener("mousedown", this.audio_start, false);
        this.mic_btn_elm.addEventListener("mouseup", this.audio_stop, false);

        this.clearId["audio_elm"] = setInterval(() => {

            if (this.$refs.audio_elm.srcObject) {
                [track] = this.$refs.audio_elm.srcObject.getAudioTracks();

                // ネゴ有りの場合、mutedが変化する
                if (this.$refs.audio_elm.srcObject && !track.muted) {
                    this.mic_btn_elm.classList.add("green_background");
                } else {
                    this.mic_btn_elm.classList.remove("green_background");
                    this.$refs.audio_elm.srcObject = null;
                }
            } else {
                this.mic_btn_elm.classList.remove("green_background");
            }
        }, 200);
        this.clearId["user_list"] = setInterval(() => {

            if (this.user_list_ttl > 0) {
                // USER_LIST SEND
                LOG(`TTL=${this.user_list_ttl} USER_LIST SEND = ${JSON.stringify({ id: myUid, group_id: group_id, name: user_name })}`);
                socketio.emit("user_list", JSON.stringify(
                    {
                        id: myUid,
                        group_id: group_id,
                        name: user_name
                    })
                );
                this.user_list_ttl--;
            } else {
                LOG(`TTL=${this.user_list_ttl} this.users is cleared & regist`);
                this.users = [];
                socketio.connect();
                // this.regist(myUid, group_id);
                this.user_list_ttl = 0;
            }
        }, 1000);
    },
    methods: {
        regist(id, group_id) {
            LOG(`REGIST: myUid=${id} / group_id=${group_id}`)
            socketio.emit("regist", JSON.stringify({
                id: id,
                group_id: group_id
            }));
        },
        async video_start() {
            const _tmp_devices = await this.get_devices();

            // ビデオデバイスの抽出を行う。
            // エアマルチ起動中でも追加があった場合、拾い上げられる様にvideo_start都度にget_devicesを実行して、
            // 配列device_idに並べる。device_idはvide_start都度、巡回する形とする。
            if (Object.keys(this.devices).length == 0) {
                this.devices = _tmp_devices;
            } else {
                const new_ids = _tmp_devices.video.filter(id => { return !this.devices.video.includes(id) });
                const leave_ids = this.devices.video.filter(id => { return !_tmp_devices.video.includes(id) });
                new_ids.forEach(new_id => { this.devices.video.push(new_id) });
                leave_ids.forEach(leave_id => { delete this.devices.video[leave_id] });
            }

            let device_id = this.devices.video.shift();
            this.constraints.video.deviceId = device_id;
            this.devices.video.push(device_id);

            try {
                if (local_stream) local_stream.getTracks().forEach(t => t.stop());
                local_stream = await this.get_local_stream(this.$refs.my_video, this.constraints);
                this.$refs.my_video.srcObject = local_stream;
                await this.$refs.my_video.play();

                this.$children.forEach(child => {
                    child.peer.pc.getTransceivers().forEach(tr => {
                        if (tr.currentDirection == "sendonly" || tr.currentDirection == "sendrecv") {
                            child.change_local_stream();
                        }
                    });
                });
            } catch (err) {
                console.log(err);
            }
        },
        audio_start(ev) {
            ev.preventDefault();
            // if (!this.$refs.remote_users) return;
            
            // if (this.audio_on_flag) return;
            this.audio_on_flag = true;

            this.mic_btn_elm.removeEventListener("mousedown", this.audio_start, false);
            this.mic_btn_elm.removeEventListener("touchstart", this.audio_start, false);
            this.clearId["audio_start"] = setTimeout(() => {
                this.mic_btn_elm.addEventListener("mousedown", this.audio_start, false);
                this.mic_btn_elm.addEventListener("touchstart", this.audio_start, false);
            }, 200);

            this.$refs.remote_users.forEach(remote_user => {
                remote_user.peer.call_in("sendonly", "audio");
            })
            this.mic_btn_elm.classList.add("red_background");
            // this.peer.call_in("sendonly", "audio");
        },
        audio_stop(ev) {
            ev.preventDefault();

            this.mic_btn_elm.classList.remove("red_background");
            // if (!this.$refs.remote_users) return;

            // console.log("--------------------------------------------------------------------")
            // this.$refs.remote_users.forEach(remote_user => {
            //     remote_user.peer.pc.getTransceivers().forEach(t => {
            //         if (!t || !t.sender || !t.sender.track) return;
            //         console.log(`${remote_user.user.name} : ${t.sender.track.kind} = ${t.currentDirection}: ${t.sender.track.enabled}`)
            //     });
            // })
            // console.log("--------------------------------------------------------------------")

            this.audio_on_flag = false;
            this.$refs.remote_users.forEach(remote_user => {
                remote_user.peer.call_out("audio");
            })
            // this.peer.call_out("audio");
            // this.peer.call_out_force("audio");
        },

        set_video_on_off(showed, id) {
            // this.cur_video_showed[id] = showed;
            // console.dir(this.cur_video_showed);
        },
        set_focus(id) {
            this.$children.forEach(child => {
                if (child.remote_id == id) {
                    child.focus_in();
                } else {
                    child.focus_out();
                }
            })
        },
        toggle_show_local_video() {
            this.show_local_video = !this.show_local_video;
        },
        async on_audio_call(call_on, stream) {
            if (call_on) {
                this.$refs.audio_elm.srcObject = stream;
                await this.$refs.audio_elm.play();
            } else {
                this.$refs.audio_elm.srcObject = null;
            }
        },
        send_msg(msg){
            socketio.emit("publish", msg);
        }
        
    },
    beforeDestroy() {
        LOG(`------------DESTROY: ${myUid}-------------`)
        Object.keys(this.clearId).forEach(key => {
            clearInterval(this.clearId[key]);
        })
        this.mic_btn_elm.removeEventListener("touchstart", this.audio_start, false);
        this.mic_btn_elm.removeEventListener("touchend", this.audio_stop, false);
        this.mic_btn_elm.removeEventListener("mousedown", this.audio_start, false);
        this.mic_btn_elm.removeEventListener("mouseup", this.audio_stop, false);
    }
})
