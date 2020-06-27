var fliper = function (video_elem){
    
    video_elem.addEventListener('click', flip);
    video_elem.addEventListener('webkitTransitionEnd', tEnd);

    function flip() {
        video_elem.style.webkitTransition = "-webkit-Transform 0.5s ease-in";
        video_elem.style.webkitTransform = "perspective(500) rotateY(90deg)";
    }

    function tEnd(e) {
        if (e.target == video_elem) {
            video_elem.style.display = "block";
            video_elem.style.webkitTransition = "-webkit-Transform 0.5s ease-out";
            window.setTimeout(function () {
                video_elem.style.webkitTransform = "perspective(500) rotate(0deg)";
            }, 0);
        }
    }
}