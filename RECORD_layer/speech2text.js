var init_s2t = function (btn_elm, result_elm) {

    if (!btn_elm) {
        LOG(`init_s2t: btn_elm is null`);
        return null;
    }

    if (!result_elm) {
        LOG(`init_s2t: result_elm is null`);
        return null;
    }

    try {
        var SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
    } catch (e) {
        return null;
    }

    var recognition = new SpeechRecognition();

    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;


    // recognition.onresult = function (event) {
    //     console.log(event);
    //     result_elm.value = event.results[0][0].transcript;
    //     recognition.stop();
    // }

    recognition.onresult = (event) => {

        var finalTranscript = ''

        console.log(event);
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript = transcript;
            }
        }
        result_elm.value = finalTranscript + interimTranscript;
    }


    var mic_on = false;

    var mic_end = function () {
        if (btn_elm.classList.contains("mic_btn_red")) {
            btn_elm.classList.remove("mic_btn_red");
            btn_elm.classList.add("mic_btn_blue");
        }
        mic_on = false;
    }
    var mic_start = function () {
        if (btn_elm.classList.contains("mic_btn_blue")) {
            btn_elm.classList.remove("mic_btn_blue");
            btn_elm.classList.add("mic_btn_red");
        }
        mic_on = true;
    }

    // recognition.onspeechend = function () {
    //     recognition.stop();
    //     mic_end();
    // }

    recognition.onnomatch = function (event) {
        result_elm.value = '認識できませんでした。。。';
        mic_end();
    }

    recognition.onerror = function (event) {
        result_elm.value = '例外が発生しました: ' + event.error;
        mic_end();
    }

    btn_elm.addEventListener('click', function (e) {

        if (mic_on) {
            recognition.stop();
            mic_end();
        } else {
            recognition.start();
            mic_start();
        }

    });

    return 1;
}


// SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;

// recognition = new SpeechRecognition();

// recognition.lang = 'ja-JP';
// recognition.interimResults = true;
// recognition.continuous = true;

// let finalTranscript = ''; // 確定した(黒の)認識結果

// let mic_flag = false;
// const toggle_speech2text = function (ev) {

//     if (ev.target.classList.contains("mic_btn_blue")) {
//         recognition.start();
//         ev.target.classList.remove("mic_btn_blue");
//         ev.target.classList.add("mic_btn_red");
//     } else {
//         recognition.stop();
//         ev.target.classList.remove("mic_btn_red");
//         ev.target.classList.add("mic_btn_blue");
//     }
// }

// var $textarea = null;
// var $btn = null;
// const speech2text = function (btn, textarea) {
//     $btn = btn;
//     $btn.addEventListener("click", toggle_speech2text);
//     $textarea = textarea;
// }

// recognition.onresult = (event) => {

//     console.log(event);
//     let interimTranscript = ''; // 暫定(灰色)の認識結果
//     for (let i = event.resultIndex; i < event.results.length; i++) {
//         let transcript = event.results[i][0].transcript;
//         if (event.results[i].isFinal) {
//             finalTranscript += transcript;
//         } else {
//             interimTranscript = transcript;
//         }
//     }
//     $_textarea.value = finalTranscript + interimTranscript;
// }

// recognition.onerror = (event) => {
//     console.log(event.error);
//     console.log(event.message);

//     recognition.stop();
//     $btn.classList.remove("mic_btn_red");
//     $btn.classList.add("mic_btn_blue");
// };

