var TrackLayer = TrackLayer || {};

// -------------------------------------------------------------
// 内部変数（クロージャ変数）
// -------------------------------------------------------------

// isVisible: 画面上軌跡が表示されているか
// isActive; 未使用
TrackLayer.vecLayer;
TrackLayer.isVisible = false;
TrackLayer.isActive = true;

  // const _state_point_num = state_point_num || 1200;
TrackLayer._state_point_num = 1200;
TrackLayer.state_colors = ["#e83e8c", "#dc3545", "#fd7e14", "#ffc107", "#28a745"];

  // -------------------------------------------------------------
  // Public関数
  // -------------------------------------------------------------

TrackLayer.add = () => {
  if (map) {
    //vec_source = new ol.source.Vector({ features: [] });
    TrackLayer.vecLayer = new ol.layer.Vector({
      source: new ol.source.Vector({ features: [] })
    });
    map.addLayer(TrackLayer.vecLayer);
    TrackLayer.vecLayer.setVisible(true);

    // update();

    socketio.on("renew", msg => {
      const newUsers = JSON.parse(msg);
      TrackLayer.on_renew(newUsers);
    });

    socketio.on("track", msg => {
      TrackLayer.on_track(JSON.parse(msg));
    });

    TrackLayer.track_show_flag = false;
    TrackLayer.trackBtn = document.getElementById("trackBtn");
    TrackLayer.trackBtn.addEventListener("click", () => {
      if (TrackLayer.track_show_flag) {
        TrackLayer.track_show_flag = false;
        TrackLayer.trackBtn.style.backgroundColor = buttonBlue;
        TrackLayer.setVisible(false);
      } else {
        TrackLayer.track_show_flag = true;
        TrackLayer.trackBtn.style.backgroundColor = buttonRed;
        TrackLayer.setVisible(true);
      }

    }, false)
  }
}

TrackLayer.remove = () => {
  map.removeLayer(vecLayer);
  socketio.off("track");
}

TrackLayer.setOpacity = (val) => {
  //val: 0.0-1.0
  TrackLayer.vecLayer.setOpacity(val);
}

TrackLayer.getOpacity = () => {
  TrackLayer.vecLayer.getOpacity();
}

TrackLayer.setVisible = (val) => {
  //val: true/false
  TrackLayer.isVisible = val;
  TrackLayer.vecLayer.setVisible(val);
}

TrackLayer.getVisible = () => {
  return TrackLayer.isVisible;
}

TrackLayer.setActive = (val) => {
  TrackLayer.isActive = val;
}

TrackLayer.getActive = () => {
  return TrackLayer.isActive;
}

// -------------------------------------------------------------
// 内部関数
// -------------------------------------------------------------

//TRACK描画要求受信
// 注意：OpenLayersでの緯度経度処理は[long,lat]でエアマルチ上とは逆
// data = {
//    user_id1: { coords1: [[lat, long], [lat, long], ...] },
//    user_id2: { coords2: [[lat, long], [lat, long], ...] },
//    ....
// }
// 一度、フォーマット変換してから_on_track_drawで描画

TrackLayer.on_track = data => {
  Object.keys(data).forEach(user_id => {
    if (data[user_id] && data[user_id].coords) {
      // log(`TRACK:data[${user_id}]=${JSON.stringify(data[user_id])}`);
      console.log(`TRACK:data[${user_id}]=${JSON.stringify(data[user_id])}`);
      data[user_id].coords = data[user_id].coords.map(pnt => {
        return ol.proj.transform([pnt[1], pnt[0]], "EPSG:4326", "EPSG:3857");
      });
      TrackLayer._on_track_draw(data[user_id]);
    }
  });
};

TrackLayer.user_color = {};
TrackLayer.get_line_color = (id) => {
  if (!(id in TrackLayer.user_color)) {
    TrackLayer.user_color[id] = TrackLayer.state_colors.shift();
    TrackLayer.state_colors.push(TrackLayer.user_color[id]);
  }
  return TrackLayer.user_color[id];
}

TrackLayer.on_renew = newUsers => {
  const req_users = {};
  if (TrackLayer.isVisible) {
    Object.keys(newUsers).forEach(user_id => {
      req_users[user_id] = {
        point_num: TrackLayer._state_point_num,
        color: TrackLayer.get_line_color(user_id),
        // group_id: activeId.id
        group_id: group_id
      };
    });
    socketio.emit("track", JSON.stringify(req_users));
  }
};

// _on_track_drawは、「手書き描画」とほぼ同じ構成
// この場合のdataは一つの描画オブジェクト
// data = {coords}
TrackLayer._on_track_draw = data => {
  // データなしor座標なしの場合は抜ける
  if (!data || !data.coords || data.coords.length == 0) {
    return;
  }
  // グループ情報を確認して自分の選択中グループでない場合は描画しない
  // 自分と送り主が両者nullの場合も同様
  // if (data.group == null || data.group != activeId.id) {
  if (data.group == null || data.group != group_id) {
      return;
  }
  // 描画レイヤからfeatureリストを取得してidが同じなら削除
  const vecLayerSource = TrackLayer.vecLayer.getSource();
  vecLayerSource.getFeatures().forEach(feature => {
    if (feature.get("id") == data.id) {
      vecLayerSource.removeFeature(feature);
    }
  });
  let geometry = new ol.geom.LineString(data.coords);
  const feature = new ol.Feature({
    geometry: geometry,
    id: data.id
  });
  const style = new ol.style.Style({
    stroke: new ol.style.Stroke({
      width: data.width,
      color: data.color
    })
  });
  feature.setStyle(style);
  // 描画
  vecLayerSource.addFeature(feature);
};