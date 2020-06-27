if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (reg) {
            // registration worked
            console.log('Registration succeeded. Scope is ' + reg.scope);
            reg.onupdatefound = function () {
                console.log('Registration: found update');
                reg.update();
            }
        }).catch(function (error) {
            // registration failed
            console.log('Registration failed with ' + error);
        });
}