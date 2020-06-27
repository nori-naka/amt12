var duration = 3000;
function flash(feature, color) {
    var start = new Date().getTime();
    var listenerKey = map.on('postcompose', animate);

    function animate(event) {
        var vectorContext = event.vectorContext;
        var frameState = event.frameState;
        var flashGeom = feature.getGeometry().clone();
        var elapsed = frameState.time - start;
        var elapsedRatio = elapsed / duration;
        // radius will be 5 at start and 30 at end.
        var radius = ol.easing.easeOut(elapsedRatio) * 25 + 5;
        var opacity = ol.easing.easeOut(1 - elapsedRatio);

        if (color == 'red'){
            style_color = `rgba(255, 0, 0, ${opacity})`;
        } else if (color == 'green') {
            style_color = `rgba(0, 255, 0, ${opacity})`;
        } else if (color == 'blue'){
            style_color = `rgba(0, 0, 255, ${opacity})`;
        }

        var style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius,
                stroke: new ol.style.Stroke({
                    color: style_color,
                    //color: 'rgba(255, 0, 0, ' + opacity + ')',
                    width: 0.25 + opacity
                })
            })
        });

        vectorContext.setStyle(style);
        vectorContext.drawGeometry(flashGeom);
        if (elapsed > duration) {
            ol.Observable.unByKey(listenerKey);
            return;
        }
        // tell OpenLayers to continue postcompose animation
        map.render();
    }
}