/**
 * 事象モジュール
 */

var JISYOU_LAYER = JISYOU_LAYER || {};

/**
 * API場所
 */
JISYOU_LAYER.apiPath = 'https://road.jrc-airmultitalk.net/mobile/api/';
// JISYOU_LAYER.apiPath = 'https://192.168.2.42/mobile/api/';

/**
 * 画像パス
 */
JISYOU_LAYER.imgPath = './';


/**
 * AJAX保存
 */
JISYOU_LAYER.ajax_store = {};

/**
 * レイヤ
 */
JISYOU_LAYER.layer = null;

/**
 * 投影座標系
 */
JISYOU_LAYER.projection = 'EPSG:3857';
JISYOU_LAYER.displayProjection = 'EPSG:4326';

/**
 * フィルタ
 */
JISYOU_LAYER.filter = {};

/**
 * キャッシュ
 */
JISYOU_LAYER.cache = {};

/**
 * 管理者かどうか
 */
JISYOU_LAYER.isAdmin = true;

/**
 * 事象取得自動更新関係
 */
JISYOU_LAYER.update_timeoutID = null;
JISYOU_LAYER.update_timeoutTime = 5000;

/**
 * カレンダー インスタンス
 */
JISYOU_LAYER.flatpickr_instance = {};

/**
 * sidebox履歴
 */
JISYOU_LAYER.history = [];

/**
 * レイヤ追加関数
 * @param ol.Map map mapオブジェクト
 * @return ol.layer.Vector レイヤオブジェクト
 */
JISYOU_LAYER.add = function (map) {
	map = map || window.map;
	var layer = new ol.layer.Vector({
		name: '事象',
		style: JISYOU_LAYER.createStyle,
		source: new ol.source.Vector({useSpatialIndex: false}),
	});
	
	if (map) {
		map.addLayer(layer);
		map.addOverlay(JISYOU_LAYER.makeOverlay());
	}
	
	JISYOU_LAYER.layer = layer;
	
	//JISYOU_LAYER.update();
	JISYOU_LAYER.autoUpdate();
	
	JISYOU_LAYER.setEvent();
	
	return layer;
};

/**
 * レイヤの透過度を指定するらしい
 * @param ? v ?
 */
JISYOU_LAYER.setOpacity = function (v) {
	JISYOU_LAYER.layer.setOpacity(v);
};

/**
 * レイヤやオーバレイを隠す
 */
JISYOU_LAYER.hidden = function () {
	JISYOU_LAYER.layer.setVisible(false);
	JISYOU_LAYER.overlay.setPosition(undefined);
};

/**
 * レイヤやオーバレイを表示する
 */
JISYOU_LAYER.visible = function () {
	JISYOU_LAYER.layer.setVisible(true);
};

/**
 * レイヤやオーバレイを削除する
 */
JISYOU_LAYER.remove = function () {
	map.removeLayer(JISYOU_LAYER.layer);
	map.removeOverlay(JISYOU_LAYER.overlay);
	JISYOU_LAYER.unsetEvent();
	
	for (var n in JISYOU_LAYER.ajax_store) {
		JISYOU_LAYER.ajax_store[n].abort();
	}
	JISYOU_LAYER.ajax_store = {};
	JISYOU_LAYER.layer = null;
	JISYOU_LAYER.overlay = null;
	
};

/**
 * 事象自動更新関数
 */
JISYOU_LAYER.autoUpdate = function () {
	clearTimeout(JISYOU_LAYER.update_timeoutID);
	JISYOU_LAYER.update();
	JISYOU_LAYER.update_timeoutID = setTimeout(JISYOU_LAYER.autoUpdate, JISYOU_LAYER.update_timeoutTime);
};

/**
 * 事象更新関数
 */
JISYOU_LAYER.update = function (_retry) {
	if (JISYOU_LAYER.ajax_store.update) {
		JISYOU_LAYER.ajax_store.update.abort();
	}
	
	var url = JISYOU_LAYER.apiPath + 'getJisyouIcon_lax.php';
	url += '?_=' + (new Date()).getTime();
	
	var xhr = new XMLHttpRequest();
	xhr.open('get', url, true);
	xhr.addEventListener('load', function(e){
		if (e.currentTarget.status != 200) {
			if (!_retry) {
				JISYOU_LAYER.update(true);
			}
			return;
		}
		JISYOU_LAYER.updateLoad(e);
	});
	xhr.withCredentials = true;
	xhr.send();
	
	JISYOU_LAYER.ajax_store.update = xhr;
	
};

/**
 * updateのXHRの通信完了
 */
JISYOU_LAYER.updateLoad = function (e) {
	var json = e.currentTarget.responseText;
	var format = new ol.format.GeoJSON({
		featureProjection: JISYOU_LAYER.projection,
	});
	var features = format.readFeatures(json);
	// クリック時のポップアップHTML
	for (var i = 0, ilen = features.length; i < ilen; ++i) {
		var feature = features[i];
		// クリック時の処理
		feature.__$do_func__ = function (e) {
			var feature = this;
			var coord = feature.getGeometry().getCoordinates();
			var contents = JISYOU_LAYER.makeFeatureContents(feature);
			var content = JISYOU_LAYER.overlay.getElement().querySelector('.ol-popup-content');
			content.innerHTML = contents;
			JISYOU_LAYER.overlay.setPosition(coord);
		};
		feature.__$undo_func__ = function (){
			JISYOU_LAYER.overlay.setPosition(undefined);
		};
	}
	var unclear_features = [];
	JISYOU_LAYER.layer.getSource().forEachFeature(function(feature){
		var data = feature.getProperties();
		if (!data.no) {
			unclear_features.push(feature);
		}
	});
	JISYOU_LAYER.layer.getSource().clear();
	JISYOU_LAYER.layer.getSource().addFeatures(features);
	JISYOU_LAYER.layer.getSource().addFeatures(unclear_features);
	JISYOU_LAYER.applyFilter();
};


/**
 * フィルタを適用する関数
 */
JISYOU_LAYER.applyFilter = function () {
	JISYOU_LAYER.layer.getSource().forEachFeature(JISYOU_LAYER.execFilter);
};

/**
 * フィルタをアイコンに適用する関数
 * @param ol.Feature feature アイコン
 */
JISYOU_LAYER.execFilter = function (feature) {
	var data = feature.getProperties();
	if (!data.no) {
		return;
	}
	var is_show = true;
	for (var name in JISYOU_LAYER.filter) {
		if (!JISYOU_LAYER.filter[name]) {
			continue;
		}
		var value = data[name];
		if (JISYOU_LAYER.filter[name].indexOf(value) == -1) {
			is_show = false;
			break;
		}
	}
	feature.setProperties({display: is_show});
};


/**
 * アイコンスタイル
 */
JISYOU_LAYER.createStyle = function (feature, resolution) {
	var data = feature.getProperties();
	var cache_key = ['icon'];
	cache_key.push(data.icon);
	cache_key.push(data.display ? 1 : 0);
	cache_key = cache_key.join('_');
	var style = JISYOU_LAYER.getCache(cache_key);
	if (!style) {
		if (data.display && data.icon) {
			style = new ol.style.Style({
				image: new ol.style.Icon({
					src: JISYOU_LAYER.imgPath + 'images/' + data.icon,
				}),
				zIndex: data.order,
			});
		} else {
			style = new ol.style.Style({});
		}
		JISYOU_LAYER.setCache(cache_key, style);
	}
	return style;
};

/**
 * キャッシュを取得する関数
 * @param string key キャッシュキー
 * @return mixed キャッシュした値
 */
JISYOU_LAYER.getCache = function (key) {
	return JISYOU_LAYER.cache[key];
};

/**
 * キャッシュを保存する関数
 * @param string key キャッシュキー
 * @param mixed data 保存する値
 */
JISYOU_LAYER.setCache = function (key, data) {
	JISYOU_LAYER.cache[key] = data;
};

/**
 * イベント
 */
JISYOU_LAYER.setEvent = function () {
	// 親がイベントを処理するため、削除
	//// featureクリックイベント
	//map.on('singleclick', JISYOU_LAYER.clickFeature);
	
	// 事象詳細
	$(JISYOU_LAYER.overlay.getElement()).on('click', '.view', JISYOU_LAYER.clickDetailBtn);
	// 事象編集
	$(document.body).on('click', '.JISYOU_LAYER_contents .edit', JISYOU_LAYER.clickEditBtn);
// 	// メニューボタン
// 	$(document.body).on('click', '.JISYOU_LAYER_contents .button', JISYOU_LAYER.clickButton);
    
    // 写真原寸大
    $(document.body).on('click', '.JISYOU_LAYER_contents .photo_box .photo', JISYOU_LAYER.showPhoto);

};

/**
 * イベント削除
 */
JISYOU_LAYER.unsetEvent = function () {
	// 親がイベントを処理するため、削除
	//map.un('singleclick', JISYOU_LAYER.clickFeature);
	
	$(JISYOU_LAYER.overlay.getElement()).off('click', JISYOU_LAYER.clickDetailBtn);
	$(document.body).off('click', '.JISYOU_LAYER_contents .edit', JISYOU_LAYER.clickEditBtn);
// 	$(document.body).off('click', '.JISYOU_LAYER_contents .button', JISYOU_LAYER.clickButton);
    $(document.body).off('click', '.JISYOU_LAYER_contents .photo_box .photo', JISYOU_LAYER.showPhoto);
};

/**
 * @deprecated
 * featureクリックイベント
 */
JISYOU_LAYER.clickFeature = function (e) {
	var features = map.getFeaturesAtPixel(e.pixel, {
		layerFilter: function(layer){return layer === JISYOU_LAYER.layer;}
	});
	if (features && features.length) {
		var feature = features[0];
		var coord = feature.getGeometry().getCoordinates();
		var contents = JISYOU_LAYER.makeFeatureContents(feature);
		var content = JISYOU_LAYER.overlay.getElement().querySelector('.ol-popup-content');
		content.innerHTML = contents;
		JISYOU_LAYER.overlay.setPosition(coord);
	}
};

/**
 * 事象詳細ボタンクリックイベント
 */
JISYOU_LAYER.clickDetailBtn = function (e) {
	var element = e.target;
	if (element.classList.contains('view')) {
		var no = element.getAttribute('data-no');
		JISYOU_LAYER.showDetail(no);
	}
};

/**
 * 事象編集ボタンクリックイベント
 */
JISYOU_LAYER.clickEditBtn = function (e) {
	var no = $(this).data('no');
	no = no || 0;
	JISYOU_LAYER.edit.no = no;
	JISYOU_LAYER.edit.init();
};

/**
 * 事象概要HTML作成
 */
JISYOU_LAYER.makeFeatureContents = function (feature) {
	var data = feature.getProperties();
	var html = ''
	         // アイコンと凡例
	         + '<div class="icons">'
	         + '<img src="'+JISYOU_LAYER.imgPath+'images/'+data.icon+'">' + JISYOU_LAYER.normalize('hanrei_text', data)
	         + '</div>'
	         + '<div class="detail">'
	         // 地先
	         + JISYOU_LAYER.normalize('tisaki', data)
	         + '<br>'
	         // 日時
	         + JISYOU_LAYER.normalize('date', data)
	         + '<br>'
	         // 施設＞分類＞対象＞状況
	         + JISYOU_LAYER.normalize('sisetu', data) + '＞'
	         + JISYOU_LAYER.normalize('bunrui', data) + '＞'
	         + JISYOU_LAYER.normalize('taisyou', data) + '＞'
	         + JISYOU_LAYER.normalize('jokyou', data) + ''
	         + '<br>'
	         // 路線上下
	         + JISYOU_LAYER.normalize('road', data) + '　'
	         + JISYOU_LAYER.normalize('updown', data) + ''
	         + '<br>'
	         // 災害処置
	         + '災害：' + JISYOU_LAYER.normalize('saigai', data) + '　'
	         + '処置：' + JISYOU_LAYER.normalize('syotizumi', data) + ''
	         + '</div>'
	         // 詳細リンク
	         + '<button class="button view" data-no="'+data.no+'">詳細</button>'
	         + '<br>'
	;
	
	return html;
};

/**
 * ふきだし作成
 */
JISYOU_LAYER.makePopup = function () {

	var div = document.createElement('div');
	div.innerHTML = '<div class="ol-popup">'
	              + '  <a href="#" class="ol-popup-closer"></a>'
	              + '  <div class="ol-popup-content"></div>'
	              + '</div>'
	;
	var container = div.querySelector('.ol-popup');
	
	return container;

};

/**
 * オーバレイ作成
 */
JISYOU_LAYER.makeOverlay = function () {
	// overlay
	var overlay = new ol.Overlay({
		element: JISYOU_LAYER.makePopup(),
		autoPan: true,
		autoPanAnimation: {
			duration: 250
		}
	});
	
	JISYOU_LAYER.overlay = overlay;
	
	// 閉じるイベント
	overlay.getElement().querySelector('.ol-popup-closer').addEventListener('click', function(e){
		JISYOU_LAYER.overlay.setPosition(undefined);
		e.currentTarget.blur();
		e.preventDefault();
	});
	
	return overlay;
};

/**
 * 事象詳細表示
 * @param int no 事象番号
 */
JISYOU_LAYER.showDetail = function (no, _retry) {
	if (JISYOU_LAYER.ajax_store.detail) {
		JISYOU_LAYER.ajax_store.detail.abort();
	}
	
	var url = JISYOU_LAYER.apiPath + 'getJisyouItem_lax.php';
	url += '?_=' + (new Date()).getTime();
	url += '&no=' + no;
	
	var xhr = new XMLHttpRequest();
	xhr.open('get', url, true);
	xhr.addEventListener('load', function(e){
		if (e.currentTarget.status != 200) {
			if (!_retry) {
				JISYOU_LAYER.showDetail(no, true);
			}
			return;
		}
		JISYOU_LAYER.detailLoad(e);
	});
	xhr.withCredentials = true;
	xhr.send();
	
	JISYOU_LAYER.ajax_store.detail = xhr;
};

/**
 * showDetailのXHRの通信完了
 */
JISYOU_LAYER.detailLoad = function (e) {
	var json = e.currentTarget.responseText;
	var data = JSON.parse(json);
	var order = [
		{key: 'kikan2'       , name: '事務所'},
		{key: 'kikan3'       , name: '出張所'},
		{key: 'code'         , name: '事象管理番号'},
		{key: 'kbn'          , name: '事象区分'},
		{key: 'date'         , name: '発見日時'},
		{key: 'road'         , name: '路線'},
		{key: 'updown'       , name: '上下区分'},
		{key: 'douro'        , name: '道路区分'},
		{key: 'tisaki'       , name: '地先名等'},
		{key: 'coordinate'   , name: '事象位置'},
		{key: 'sisetu'       , name: '施設'},
		{key: 'bunrui'       , name: '分類'},
		{key: 'taisyou'      , name: '対象'},
		{key: 'jokyou'       , name: '状況'},
		{key: 'syoti'        , name: '措置作業内容'},
		{key: 'keisoku'      , name: '計測項目'},
		{key: 'taiou'        , name: '措置作業方針'},
		{key: 'date_syoti'   , name: '措置済確認日'},
		{key: 'taiou_bikou'  , name: '対応内容'},
		{key: 'bikou'        , name: '備考'},
		{key: 'photo'        , name: '関連画像・写真'},
	];
	var html = [];
	for (var i = 0, ilen = order.length; i < ilen; ++i) {
		var key = order[i].key;
		var name = order[i].name;
		html[html.length] = '<tr><th>' + name + '</th><td>' + JISYOU_LAYER.normalize(key, data) + '</td></tr>';
	}
	html = '<table>' + html.join('') + '</table>';
	// 管理者の場合は登録可
	if (JISYOU_LAYER.isAdmin) {
		html = '<button data-no="'+data.no+'" class="button single control edit">編集</button>' + html;
	}
	//html = '<div style="height:300px;overflow:auto;" class="JISYOU_LAYER_contents">' + html + '</div>';
	html = '<div class="JISYOU_LAYER_contents">' + html + '</div>';
	
	//var content = JISYOU_LAYER.overlay.getElement().querySelector('.ol-popup-content');
	//content.innerHTML = html;
	
	JISYOU_LAYER.sidebox_show(html);
	
};

/**
 * 事象番号から事象ポップアップを開く
 * @param int no 事象番号
 */
JISYOU_LAYER.showPopup = function (no) {
	JISYOU_LAYER.layer.getSource().forEachFeature(function(feature){
		if (feature.getProperties().no == no) {
			if (feature.__$do_func__) {feature.__$do_func__();}
		}
	});
}

/**
 * 引き継ぎメモ
 */
JISYOU_LAYER.getHikitugi = function () {
	JISYOU_LAYER.ajax_store.hikitugi = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getHikitugiList_lax.php',
		type: 'get',
		data: {},
		cache: false,
		dataType: 'json',
	}).done(JISYOU_LAYER.showHikitugi).fail(JISYOU_LAYER.errorData);
};

/**
 * 引き継ぎメモ表示
 */
JISYOU_LAYER.showHikitugi = function (data) {
	var area = [];
	for (var i = 0, ilen = data.data.length; i < ilen; ++i) {
		var dt = data.data[i];
		var h = '<table class="junkai_plan_list" data-no="'+dt.no+'"><tbody>'
		      + '<tr><td>登録日</td><td>' + JISYOU_LAYER.normalize('date_ymd', dt) + '</td></tr>'
		      + '<tr><td>巡回ルート</td><td>' + JISYOU_LAYER.normalize('route', dt) + '</td></tr>'
		      + '<tr><td>引き継ぎメモ</td><td>' + JISYOU_LAYER.normalize('hikitugi', dt) + '</td></tr>'
		      + '<tr><td>担当者</td><td>' + JISYOU_LAYER.normalize('tantou', dt) + '</td></tr>'
		      + '<tr><td colspan="2"><button class="button edit_hikitugi single">修正</button><button class="button delete_hikitugi single">削除</button></td></tr>'
		      + '</tbody></table>'
		;
		
		var card = '<button class="card hikitugi single">' + h + '</button>';
		area.push(card);
	}
	
	var route_select = JISYOU_LAYER.makeSelect(data.route);
	var tantou_select = JISYOU_LAYER.makeSelect(data.tantou);
	
	var now = (new Date()).toISOString();
	now = now.split('T').shift();
	
	var area2 = '<div class="card"><table class="junkai_plan_list new">'
		      + '<tr><td>登録日</td><td><input type="date" name="date" value="'+now+'"></td></tr>'
		      + '<tr><td>巡回ルート</td><td><select name="route">' + route_select + '</select></td></tr>'
		      + '<tr><td>引き継ぎメモ</td><td><textarea name="hikitugi"></textarea></td></tr>'
		      + '<tr><td>担当者</td><td><select name="tantou">' + tantou_select + '</select></td></tr>'
	          + '<tr><td colspan="2"><button type="button" class="button new_hikitugi single">登録</button></td></tr>'
	          + '</table></div>'
	;
	var html = '<div class="JISYOU_LAYER_contents">'
	         + ' 引き継ぎメモ'
	         + ' <div class="list_area">'+area+'</div>'
	         + ' 新規'
	         + ' <div class="list_area">'+area2+'</div>'
	         + '</div>'
	;
	
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.unsetHikitugiEvent, JISYOU_LAYER.setHikitugiEvent);
	
};

/**
 * 引き継ぎメモイベント
 */
JISYOU_LAYER.setHikitugiEvent = function () {
	$(document).on('click', '.JISYOU_LAYER_contents .button.edit_hikitugi', JISYOU_LAYER.editHikitugi);
	$(document).on('click', '.JISYOU_LAYER_contents .button.delete_hikitugi', JISYOU_LAYER.deleteHikitugi);
	$(document).on('click', '.JISYOU_LAYER_contents .button.new_hikitugi', JISYOU_LAYER.addHikitugi);
	$(document).on('click', '.JISYOU_LAYER_contents .button.update_hikitugi', JISYOU_LAYER.updateHikitugi);
	$(document).on('click', '.JISYOU_LAYER_contents .button.cancel_hikitugi', JISYOU_LAYER.cancelHikitugi);
};
JISYOU_LAYER.unsetHikitugiEvent = function () {
	$(document).off('click', '.JISYOU_LAYER_contents .button.edit_hikitugi', JISYOU_LAYER.editHikitugi);
	$(document).off('click', '.JISYOU_LAYER_contents .button.delete_hikitugi', JISYOU_LAYER.deleteHikitugi);
	$(document).off('click', '.JISYOU_LAYER_contents .button.new_hikitugi', JISYOU_LAYER.addHikitugi);
	$(document).off('click', '.JISYOU_LAYER_contents .button.update_hikitugi', JISYOU_LAYER.updateHikitugi);
	$(document).off('click', '.JISYOU_LAYER_contents .button.cancel_hikitugi', JISYOU_LAYER.cancelHikitugi);
};

/**
 * 引き継ぎメモ編集
 */
JISYOU_LAYER.editHikitugi = function () {
	var $table = $(this).closest('.junkai_plan_list');
	var $wrap = $table.closest('.JISYOU_LAYER_contents');
	var $new = $wrap.find('.junkai_plan_list.new');
	var $edit = $('<tbody></tbody>');
	$new.find('tr').each(function(){
		var $tr = $(this);
		$edit.append($tr.clone());
	});
	
	// 初期値
	var $tr = $table.find('tr');
	var date = $tr.eq(0).find('td').eq(1).text();
	date = new Date(date);
	date = JISYOU_LAYER.date2str(date, 21);
	var route = $tr.eq(1).find('td').eq(1).text();
	var hikitugi = $tr.eq(2).find('td').eq(1).text();
	var tantou = $tr.eq(3).find('td').eq(1).text();
	$edit.find('[name="date"]').val(date);
	$edit.find('[name="route"]').find('option').each(function(){
		var $$ = $(this);
		if ($$.text() == route) {$$.prop('selected', true);}
	});
	$edit.find('[name="hikitugi"]').val(hikitugi);
	$edit.find('[name="tantou"]').find('option').each(function(){
		var $$ = $(this);
		if ($$.text() == tantou) {$$.prop('selected', true);}
	});
	
	// ボタン
	var $wrap_btn = $edit.find('button').parent();
	$wrap_btn.empty();
	$wrap_btn.append('<button type="button" class="button update_hikitugi single">更新</button>');
	$wrap_btn.append('<button type="button" class="button cancel_hikitugi single">キャンセル</button>');
	
	$table.find('tbody').css('display', 'none');
	$table.append($edit);
	
	
};
/**
 * 引き継ぎメモ更新
 */
JISYOU_LAYER.updateHikitugi = function () {
	var $wrap = $(this).closest('.junkai_plan_list');
	var no = $wrap.data('no');
	var date = $wrap.find('[name="date"]').val();
	var route = $wrap.find('[name="route"]').val();
	var hikitugi = $wrap.find('[name="hikitugi"]').val();
	var tantou = $wrap.find('[name="tantou"]').val();
	if (!hikitugi) {
		alert('引き継ぎメモが入力されていません。');
		return;
	}
	var data = {
		kind: 'upd',
		no: no,
		date: date,
		route: route,
		hikitugi: hikitugi,
		tantou: tantou,
	};
	$.ajax({
		url: JISYOU_LAYER.apiPath + 'updateHikitugi_lax.php',
		type: 'post',
		data: data,
	}).done(JISYOU_LAYER.getHikitugi);

};
/**
 * 引き継ぎメモ編集キャンセル
 */
JISYOU_LAYER.cancelHikitugi = function () {
	var $table = $(this).closest('.junkai_plan_list');
	while ($table.find('tbody').length > 1) {
		$table.find('tbody').last().remove();
	}
};



/**
 * 引き継ぎメモ削除
 */
JISYOU_LAYER.deleteHikitugi = function () {
	if (!confirm('削除します。よろしいですか？')) {
		return;
	}
	var no = $(this).closest('.junkai_plan_list').data('no');
	$.ajax({
		url: JISYOU_LAYER.apiPath + 'updateHikitugi_lax.php',
		type: 'post',
		data: {kind: 'del', no: no},
	}).done(JISYOU_LAYER.getHikitugi);
};

/**
 * 引き継ぎメモ新規
 */
JISYOU_LAYER.addHikitugi = function () {
	var $wrap = $(this).closest('.junkai_plan_list');
	var date = $wrap.find('[name="date"]').val();
	var route = $wrap.find('[name="route"]').val();
	var hikitugi = $wrap.find('[name="hikitugi"]').val();
	var tantou = $wrap.find('[name="tantou"]').val();
	if (!hikitugi) {
		alert('引き継ぎメモが入力されていません。');
		return;
	}
	var data = {
		kind: 'ins',
		date: date,
		route: route,
		hikitugi: hikitugi,
		tantou: tantou,
	};
	$.ajax({
		url: JISYOU_LAYER.apiPath + 'updateHikitugi_lax.php',
		type: 'post',
		data: data,
	}).done(JISYOU_LAYER.getHikitugi);
};

/**
 * データ正規化関数
 * @param string key 対象キー
 * @param object data データ格納オブジェクト
 * @return mixed 正規化後の値
 */
JISYOU_LAYER.normalize = function (key, data, opt_options) {
	var options = opt_options || {};
	
	var dt = data[key];
	switch (key) {
		// 時刻
		case 'date':
			if (!dt) {
				dt = '未入力';
			} else {
				var str = dt.replace(/-/g, '/').split('.').shift();
				var date = new Date(str);
				if (!isNaN(date.getTime())) {
					if (options.edit) {
						dt = JISYOU_LAYER.date2str(date, 20);
					} else {
						dt = JISYOU_LAYER.date2str(date, 10);
					}
				} else {
					dt = '';
				}
			}
			break;
		case 'date_syoti':
			if (!dt) {
				if (options.edit) {
					dt = null;
				} else {
					dt = '未入力';
				}
			} else {
				var str = dt.replace(/-/g, '/').split('.').shift();
				var date = new Date(str);
				if (!isNaN(date.getTime())) {
					if (options.edit) {
						dt = JISYOU_LAYER.date2str(date, 21);
					} else {
						dt = JISYOU_LAYER.date2str(date, 11);
					}
				} else {
					dt = '';
				}
			}
			break;
		case 'date_md':
			dt = data['date'];
			if (!dt) {
				dt = '未入力';
			} else {
				var str = dt.replace(/-/g, '/').split('.').shift();
				var date = new Date(str);
				if (!isNaN(date.getTime())) {
					dt = JISYOU_LAYER.date2str(date, 4);
				} else {
					dt = '';
				}
			}
			break;
		case 'date_ymd':
			dt = data['date'];
			if (!dt) {
				dt = '未入力';
			} else {
				var str = dt.replace(/-/g, '/').split('.').shift();
				var date = new Date(str);
				if (!isNaN(date.getTime())) {
					dt = JISYOU_LAYER.date2str(date, 11);
				} else {
					dt = '';
				}
			}
			break;
		// 通常、災害
		case 'saigai':
			if (dt == null) {
				dt = '';
			} else if (dt == 0) {
				dt = '通常';
			} else {
				dt = '災害';
			}
			break;
		// 未処置、処置済み
		case 'syotizumi':
			if (dt == null) {
				dt = '';
			} else if (dt == 0) {
				dt = '未処置';
			} else {
				dt = '処置済';
			}
			break;
		// 事象区分
		case 'kbn':
			var s = JISYOU_LAYER.normalize('saigai', data, options);
			if (data.kinkyuu == 1) {
				s += '：緊急';
			}
			dt = s;
			break;
		// 事象位置
		case 'coordinate':
			// N139°29′32″E38°13′29″
			var dhb = JISYOU_LAYER.convLonLat([data.longitude, data.latitude]);
			var lonlat_text = 'N'+dhb[0][0]+'°'+dhb[0][1]+'′'+dhb[0][2]+'″　'
			                + 'E'+dhb[1][0]+'°'+dhb[1][1]+'′'+dhb[1][2]+'″';
			dt = lonlat_text;
			break;
		// 計測項目
		case 'keisoku':
			if (!dt) {
				dt = '';
			} else {
				var s = [];
				for (var i = 0, ilen = dt.length; i < ilen; ++i) {
					var name = dt[i].keisoku;
					var value = dt[i].keisoku_value;
					s.push(name + ' = ' + value);
				}
				dt = s.join('<br>');
			}
			break;
		// 措置作業方針
		case 'taiou':
			if (!dt) {
				dt = '未入力';
			}
			break;
		// 対応内容
		case 'taiou_bikou':
			if (!dt) {
				if (options.edit) {
					dt = '';
				} else {
					dt = '未入力';
				}
			}
			break;
		// 関連画像・写真
		case 'photo':
			if (!dt) {
				dt = '';
			} else {
				var s = [];
				for (var i = 0, ilen = dt.length; i < ilen; ++i) {
					var html = '';
					if (options.edit) {
						html = JISYOU_LAYER.edit.makePhotoHTMLEdit(dt[i]);
					} else {
						html = JISYOU_LAYER.makePhotoHTML(dt[i]);
					}
					s.push(html);
				}
				if (s.length == 0) {
					s = ['なし'];
				}
				dt = '<div class="wrap_photo">' + s.join('') + '</div>';
			}
			break;
		// 措置作業内容
		case 'syoti':
			if (dt == null) {
				dt = '';
			}
			break;
	}
	return dt;
};

// 日付
JISYOU_LAYER.date2str = function (date, flag) {
	flag = flag || 0;
	var ret = '';
	var ymd = [date.getFullYear(), ('00'+(date.getMonth()+1)).slice(-2), ('00'+date.getDate()).slice(-2)];
	var his = [('00'+date.getHours()).slice(-2), ('00'+(date.getMinutes())).slice(-2), ('00'+date.getSeconds()).slice(-2)];
	switch (flag) {
		default:
		case 0: // YYYY/MM/DD hh:ii:ss
			ret = ymd.join('/')+' '+his.join(':');
			break;
		case 1: // YYYYMMDDhhiiss
			ret = ymd.join('')+his.join('');
			break;
		case 2: // YYYY年MM月DD日 hh時ii分ss秒
			ret = ymd[0]+'年'+ymd[1]+'月'+ymd[2]+'日'+' '+his[0]+'時'+his[1]+'分'+his[2]+'秒';
			break;
		case 3: // YYYY年MM月DD日 hh:ii:ss
			ret = ymd[0]+'年'+ymd[1]+'月'+ymd[2]+'日'+' '+his.join(':');
			break;
		case 4: // MM月DD日
			ret = ymd[1]+'月'+ymd[2]+'日';
			break;
		case 5: // hh:ii
			ret = his.slice(0, 2).join(':');
			break;
		case 10: // YYYY/MM/DD hh:ii
			ret = ymd.join('/')+' '+his.slice(0, 2).join(':');
			break;
		case 11: // YYYY/MM/DD
			ret = ymd.join('/');
			break;
		case 12: // YYYY年MM月DD日 hh:ii
			ret = ymd[0]+'年'+ymd[1]+'月'+ymd[2]+'日'+' '+his.slice(0, 2).join(':');
			break;
		case 20: // YYYY-MM-DDThh:ii:ss
			ret = ymd.join('-')+'T'+his.join(':');
			break;
		case 21: // YYYY-MM-DD
			ret = ymd.join('-');
			break;
		case 22: // YYYY-MM DDThh:ii
			ret = ymd.join('-')+'T'+his.slice(0, 2).join(':');
			break;
	}
	return ret;
	
};

/**
 * 緯度経度を度分秒に変換
 */
JISYOU_LAYER.convLonLat = function (lonlat) {
	var lon = lonlat[0];
	var lat = lonlat[1];
	
	var ret = [[],[]];
	// 度
	ret[0][0] = Math.floor(lon);
	ret[1][0] = Math.floor(lat);
	// 分
	var lontmp = (lon - ret[0][0]) * 60;
	var lattmp = (lat - ret[1][0]) * 60;
	ret[0][1] = Math.floor(lontmp);
	ret[1][1] = Math.floor(lattmp);
	// 秒
	ret[0][2] = Math.floor((lontmp - ret[0][1]) * 60);
	ret[1][2] = Math.floor((lattmp - ret[1][1]) * 60);
	
	
	return ret;
};

/**
 * 画像HTMLを作成する関数
 */
JISYOU_LAYER.makePhotoHTML = function (data) {
	var file = 'data:image/' + data.ext + ';base64,' + data.photo_data;
	var photo_type = {1:'附図', 2:'路線図', 3:'写真', 4:'その他'}[data.photo_type];
	
	var html = '<div class="photo_box">'
//	         + '<div class="center"><span class="daihyo">代表写真</span><span class="nissi">巡回日誌</span></div>'
	         + '<div><img src="' + file + '" width="200" class="photo"></div>'
	         + '<div>' + photo_type + '</div>'
	         + '<div>' + data.bikou + '</div>'
	         + '</div>';
	
	return html;
	
};


/**
 * 写真原寸大表示
 */
JISYOU_LAYER.showPhoto = function () {
	var img = this;
	var src = img.src;
	var html = '<table width="100%" height="100%"><tr><td align="center" valign="middle"><img src="'+src+'"></td></tr></table>';
	centorbox_show(html);
};


/**
 * selectのoption作成
 * @param array data {value: value, text: テキスト}の配列
 * @return string option文字列
 */
JISYOU_LAYER.makeSelect = function (data) {
	var ret = [];
	for (var i = 0, ilen = data.length; i < ilen; ++i) {
		var dt = data[i];
		ret.push('<option value="'+dt.value+'">'+dt.text+'</option>');
	}
	return ret.join('');
};


/*********************************************************************/
// edit
JISYOU_LAYER.edit = {};
// 番号
JISYOU_LAYER.edit.no = 0;
JISYOU_LAYER.edit.select = null;
JISYOU_LAYER.edit.text_length = null;
JISYOU_LAYER.edit.data = null;
// データ
JISYOU_LAYER.edit.jdata = {
	point: [],
	photo: [],
};
// 必須項目
JISYOU_LAYER.edit.require = {
	SISETU_DOURO: 1,
	BUNRUI_SYADOU: 1,
	KEISOKU_SYASEN: '車線',
};
// 事象位置仮置き
JISYOU_LAYER.edit.temp_feature = null;

// 編集終了後に実行する関数
JISYOU_LAYER.edit.end_func = null;

/**
 * 事象編集起動
 */
JISYOU_LAYER.edit.init = function (edit_end_func) {
	JISYOU_LAYER.edit.getData(JISYOU_LAYER.edit.no);
	JISYOU_LAYER.edit.end_func = edit_end_func;
};

/**
 * 事象取得
 */
JISYOU_LAYER.edit.getData = function (no) {
	if (JISYOU_LAYER.ajax_store.getData) {
		JISYOU_LAYER.ajax_store.getData.abort();
	}
	JISYOU_LAYER.ajax_store.getData = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJisyouEdit_lax.php',
		type: 'get',
		data: {no: no},
		cache: false,
		dataType: 'json',
	}).done(JISYOU_LAYER.edit.showData).fail(JISYOU_LAYER.edit.errorData);
};

/**
 * 事象データ取得エラー
 */
JISYOU_LAYER.edit.errorData = function (e) {
	console.log(e);
};

/**
 * 事象表示
 */
JISYOU_LAYER.edit.showData = function (data) {
	JISYOU_LAYER.edit.select = data.select;
	JISYOU_LAYER.edit.text_length = data.text_length;
	JISYOU_LAYER.edit.data = data.data;
	
	var delbtn = data.data.no ? '<button class="button single control delete">削除</button>' : '';
	var date = new Date();
	var date_s = JISYOU_LAYER.date2str(new Date(), 22);
	var html = ''
	         + '<div class="JISYOU_LAYER_contents wrap_edit">'
	         + ' <button class="button single control regist">登録</button>'
	         +   delbtn
	         + ' <input type="hidden" class="no" name="no">'
	         + ' <table>'
	         + ' <tbody>'
	         + '  <tr>'
	         + '   <th>事務所</th>'
	         + '   <td><select class="kikan2" name="kikan2"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>出張所</th>'
	         + '   <td><select class="kikan3" name="kikan3"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>事象区分</th>'
	         + '   <td><select class="kbn" name="kbn"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>発見日時<span class="red">（必須）</span></th>'
	         + '   <td><input type="datetime-local" class="date" name="date" value="'+date_s+'" max="'+date_s+'"></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>路線</th>'
	         + '   <td><select class="road" name="road"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>上下区分</th>'
	         + '   <td><select class="updown" name="updown"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>道路区分</th>'
	         + '   <td><select class="douro" name="douro"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>地先名等(50文字)</th>'
	         + '   <td><input type="text" class="tisaki" name="tisaki"></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>事象位置<span class="red">（必須）</span></th>'
	         + '   <td><button type="button" class="coordinate" name="coordinate">位置指定</button><input type="hidden" class="jisyou_type" name="jisyou_type"><input type="hidden" class="latitude" name="latitude"><input type="hidden" class="longitude" name="longitude"></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>施設<span class="red">（必須）</span></th>'
	         + '   <td><select class="sisetu" name="sisetu"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>分類<span class="red">（必須）</span></th>'
	         + '   <td><select class="bunrui" name="bunrui"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>対象<span class="red">（必須）</span></th>'
	         + '   <td><select class="taisyou" name="taisyou"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>状況<span class="red">（必須）</span></th>'
	         + '   <td><select class="jokyou" name="jokyou"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>措置作業内容</th>'
	         + '   <td><select class="syoti" name="syoti"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>計測項目</th>'
	         + '   <td><div class="keisoku_area" name="keisoku_area"></div></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>措置作業方針</th>'
	         + '   <td><input type="checkbox" class="syotizumi" name="syotizumi" value="1">未対応<select class="taiou" name="taiou"></select></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>措置済確認日</th>'
	         + '   <td><input type="date" class="date_syoti" name="date_syoti"></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>対応内容(50文字)</th>'
	         + '   <td><input type="text" class="taiou_bikou" name="taiou_bikou"></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>備考(120文字)</th>'
	         + '   <td><textarea class="bikou" name="bikou"></textarea></td>'
	         + '  </tr>'
	         + '  <tr>'
	         + '   <th>関連画像・写真</th>'
	         + '   <td><div class="photo_area"></div><label for="JISYOU_LAYER_photo_input"><button class="addphoto" type="button">追加</button></label><input type="file" class="photo_input" accept=".jpg,.png,.gif,.jpeg" style="visibility: hidden; position: absolute; top: -200px; width: 0; height: 0;" id="JISYOU_LAYER_photo_input"></td>'
	         + '  </tr>'
	         + ' </tbody>'
	         + ' </table>'
	         + '</div>'
	;
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.edit.unsetEvent, function(){
		JISYOU_LAYER.edit.makeContents();
		JISYOU_LAYER.edit.setEvent();
		JISYOU_LAYER.edit.setTextLength();
		if (JISYOU_LAYER.edit.data.no == null) {
			// 事象位置初期値
			var position = JISYOU_LAYER.getPosition();
			var ll = ol.proj.transform(position, 'EPSG:3857', 'EPSG:4326');
			JISYOU_LAYER.edit.updateLonLat([ll], 1);
	// 		var dhb = JISYOU_LAYER.convLonLat(ll);
	// 		var lonlat_text = 'N'+dhb[0][0]+'°'+dhb[0][1]+'′'+dhb[0][2]+'″　'
	// 		                + 'E'+dhb[1][0]+'°'+dhb[1][1]+'′'+dhb[1][2]+'″';
	// 		var $wrap = $('.JISYOU_LAYER_contents.wrap_edit');
	// 		$wrap.find('.coordinate').html(lonlat_text);
			return;
		}
		var order = [
			{key: 'no'           , name: '番号'},
			{key: 'kikan2'       , name: '事務所'},
			{key: 'kikan3'       , name: '出張所'},
			{key: 'code'         , name: '事象管理番号'},
			{key: 'kbn'          , name: '事象区分'},
			{key: 'date'         , name: '発見日時'},
			{key: 'road'         , name: '路線'},
			{key: 'updown'       , name: '上下区分'},
			{key: 'douro'        , name: '道路区分'},
			{key: 'tisaki'       , name: '地先名等'},
			{key: 'coordinate'   , name: '事象位置'},
			{key: 'jisyou_type'  , name: '位置種別'},
			{key: 'latitude'     , name: '位置緯度'},
			{key: 'longitude'    , name: '位置経度'},
			{key: 'sisetu'       , name: '施設'},
			{key: 'bunrui'       , name: '分類'},
			{key: 'taisyou'      , name: '対象'},
			{key: 'jokyou'       , name: '状況'},
			{key: 'syotizumi'    , name: '処置済み'},
			{key: 'syoti'        , name: '措置作業内容'},
			{key: 'keisoku'      , name: '計測項目'},
			{key: 'taiou'        , name: '措置作業方針'},
			{key: 'date_syoti'   , name: '措置済確認日'},
			{key: 'taiou_bikou'  , name: '対応内容'},
			{key: 'bikou'        , name: '備考'},
			{key: 'photo'        , name: '関連画像・写真'},
		];
		var options = {
			'edit': 1,
		};
		var $wrap = $('.JISYOU_LAYER_contents.wrap_edit');
		for (var i = 0, ilen = order.length; i < ilen; ++i) {
			var key = order[i].key;
			var name = order[i].name;
			var value = JISYOU_LAYER.normalize(key, JISYOU_LAYER.edit.data, options);
			// 特殊処理
			if (key == 'keisoku') {
				JISYOU_LAYER.edit.showKeisokuData(JISYOU_LAYER.edit.data);
				continue;
			}
			if (key == 'photo') {
				JISYOU_LAYER.edit.showPhotoData(JISYOU_LAYER.edit.data);
				continue;
			}
			// 表示要素
			var $element = $wrap.find('.' + key);
			if ($element.length == 0) {
				console.log(key);
				continue;
			}
			// ノードによる処理
			var node = $element[0].nodeName.toLowerCase();
			if (node == 'span' || node == 'button') {
				// そのまま表示
				$element.html(value);
			} else if (node == 'select') {
				// 選択
				$element.find('option').filter(function(){
					return $(this).text() == value;
				}).prop('selected', true);
			} else if (key == 'syotizumi') {
				// チェックボックス
				if (JISYOU_LAYER.edit.data[key] == 0) {
					$element.prop('checked', true);
				}
			} else {
				// 入力欄
				$element.val(value);
			}
			$element.trigger('change');
		}
		
	});
};

/**
 * 計測データ表示
 */
JISYOU_LAYER.edit.showKeisokuData = function (data) {
	var $element = $('.JISYOU_LAYER_contents.wrap_edit').find('.keisoku_area');
	for (var i = 0, ilen = data.keisoku.length; i < ilen; ++i) {
		var value = data.keisoku[i].keisoku_value;
		var ix = data.keisoku[i].ix;
		var target = 'cd_keisoku_' + ix;
		$element.find('input[name="'+target+'"]').val(value);
	}
}

/**
 * 写真データ表示
 */
JISYOU_LAYER.edit.showPhotoData = function (data) {
	var $element = $('.JISYOU_LAYER_contents.wrap_edit').find('.photo_area');
	$element.html(JISYOU_LAYER.normalize('photo', data, {edit: 1}));
}

/**
 * コンテンツ作成
 */
JISYOU_LAYER.edit.makeContents = function () {

	// 事務所
	JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.kikan2, 'kikan2', 'cd_kikan2', 'kikan2');
	// 出張所
	JISYOU_LAYER.edit.makeKikan3Select();
	// 事象区分
	JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.kbn, 'kbn', 'value', 'text');
	// 路線
	JISYOU_LAYER.edit.makeRoadSelect();
	// 上下区分
	JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.updown, 'updown', 'cd_joge_point', 'joge_point');
	// 道路区分
	JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.douro, 'douro', 'cd_douro', 'douro');
	// 事象項目　施設
	JISYOU_LAYER.edit.makeSisetuSelect();
	// 事象項目　分類
	JISYOU_LAYER.edit.makeBunruiSelect();
	// 事象項目　対象
	JISYOU_LAYER.edit.makeTaisyouSelect();
	// 事象項目　状況
	JISYOU_LAYER.edit.makeJokyouSelect();
	// 処置
	JISYOU_LAYER.edit.makeSyotiSelect();
	// 計測
	JISYOU_LAYER.edit.makeKeisoku();
	// 対応
	JISYOU_LAYER.edit.makeTaiou();
}

/**
 * 出張所セレクト作成
 */
JISYOU_LAYER.edit.makeKikan3Select = function () {
    var filter = {};
    filter.cd_kikan2 = $('.JISYOU_LAYER_contents.wrap_edit').find('.kikan2').find('option:selected').val();
    return JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.kikan3, 'kikan3', 'cd_kikan3', 'kikan3', filter);
}

/**
 * 路線セレクト作成
 */
JISYOU_LAYER.edit.makeRoadSelect = function () {
    var filter = {};
    filter.cd_kikan2 = $('.JISYOU_LAYER_contents.wrap_edit').find('.kikan2').find('option:selected').val();
    filter.cd_kikan3 = $('.JISYOU_LAYER_contents.wrap_edit').find('.kikan3').find('option:selected').val();
    return JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.road, 'road', 'cd_road', 'road', filter);
}

/**
 * 施設セレクト作成
 */
JISYOU_LAYER.edit.makeSisetuSelect = function () {
    var filter = {};
    filter.flag_saigai = $('.JISYOU_LAYER_contents.wrap_edit').find('.kbn').find('option:selected').val();
    return JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.sisetu, 'sisetu', 'cd_sisetu', 'sisetu', filter, '');
}

/**
 * 分類セレクト作成
 */
JISYOU_LAYER.edit.makeBunruiSelect = function () {
    var filter = {};
    filter.flag_saigai = $('.JISYOU_LAYER_contents.wrap_edit').find('.kbn').find('option:selected').val();
    filter.cd_sisetu = $('.JISYOU_LAYER_contents.wrap_edit').find('.sisetu').find('option:selected').val();
    return JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.bunrui, 'bunrui', 'cd_bunrui', 'bunrui', filter, '');
}

/**
 * 対象セレクト作成
 */
JISYOU_LAYER.edit.makeTaisyouSelect = function () {
    var filter = {};
    filter.flag_saigai = $('.JISYOU_LAYER_contents.wrap_edit').find('.kbn').find('option:selected').val();
    filter.cd_sisetu = $('.JISYOU_LAYER_contents.wrap_edit').find('.sisetu').find('option:selected').val();
    filter.cd_bunrui = $('.JISYOU_LAYER_contents.wrap_edit').find('.bunrui').find('option:selected').val();
//    JISYOU_LAYER.edit.makeSelect(taisyou, 'taisyou', 'cd_taisyou', 'taisyou', filter);

    var $select = $('.JISYOU_LAYER_contents.wrap_edit').find('.taisyou').empty();
    if ($select.length == 0) {
        $select = $('<select></select>').attr('id', id);
    }
    $('<option value=""></option>').appendTo($select);
    $.each(JISYOU_LAYER.edit.select.taisyou, function (i, v) {
        for (var n in filter) {
            if ((n in v) && filter[n] != v[n]) {
                return true;
            }
        }
        var vv = v['cd_taisyou'];
        var vt = v['taisyou'];
        var va = v['cd_hanrei'];
        $('<option value="'+vv+'" data-hanrei="'+va+'">'+vt+'</option>').appendTo($select);
    });
    // 更新
    $select[0].multiple = !($select[0].multiple = !$select[0].multiple);
    
    return $select;
}

/**
 * 状況セレクト作成
 */
JISYOU_LAYER.edit.makeJokyouSelect = function () {
    var filter = {};
    filter.flag_saigai = $('.JISYOU_LAYER_contents.wrap_edit').find('.kbn').find('option:selected').val();
    filter.cd_sisetu = $('.JISYOU_LAYER_contents.wrap_edit').find('.sisetu').find('option:selected').val();
    filter.cd_bunrui = $('.JISYOU_LAYER_contents.wrap_edit').find('.bunrui').find('option:selected').val();
    filter.cd_taisyou = $('.JISYOU_LAYER_contents.wrap_edit').find('.taisyou').find('option:selected').val();
    return JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.jokyou, 'jokyou', 'cd_jokyou', 'jokyou', filter, '');
}

/**
 * 措置作業内容セレクト作成
 */
JISYOU_LAYER.edit.makeSyotiSelect = function () {
    var filter = {};
    filter.flag_saigai = $('.JISYOU_LAYER_contents.wrap_edit').find('.kbn').find('option:selected').val();
    filter.cd_sisetu = $('.JISYOU_LAYER_contents.wrap_edit').find('.sisetu').find('option:selected').val();
    filter.cd_bunrui = $('.JISYOU_LAYER_contents.wrap_edit').find('.bunrui').find('option:selected').val();
    filter.cd_taisyou = $('.JISYOU_LAYER_contents.wrap_edit').find('.taisyou').find('option:selected').val();
//    JISYOU_LAYER.edit.makeSelect(syoti, 'syoti', 'cd_syoti', 'syoti', filter);
    var $select = $('.JISYOU_LAYER_contents.wrap_edit').find('.syoti').empty();
    if ($select.length == 0) {
        $select = $('<select></select>').attr('id', id);
    }
    $.each(JISYOU_LAYER.edit.select.syoti, function (i, v) {
        for (var n in filter) {
            if ((n in v) && filter[n] != v[n]) {
                return true;
            }
        }
        var vv = v['cd_syoti'];
        var vt = v['syoti'];
        var va = v['cd_syoti_type'];
        $('<option value="'+vv+'" data-type="'+va+'">'+vt+'</option>').appendTo($select);
    });
    // 更新
    $select[0].multiple = !($select[0].multiple = !$select[0].multiple);
    
    return $select;
}

/**
 * 計測エリア作成
 */
JISYOU_LAYER.edit.makeKeisoku = function () {
    var filter = {};
    filter.flag_saigai = $('.JISYOU_LAYER_contents.wrap_edit').find('.kbn').find('option:selected').val();
    filter.cd_sisetu = $('.JISYOU_LAYER_contents.wrap_edit').find('.sisetu').find('option:selected').val();
    filter.cd_bunrui = $('.JISYOU_LAYER_contents.wrap_edit').find('.bunrui').find('option:selected').val();
    filter.cd_taisyou = $('.JISYOU_LAYER_contents.wrap_edit').find('.taisyou').find('option:selected').val();
    filter.cd_jokyou = $('.JISYOU_LAYER_contents.wrap_edit').find('.jokyou').find('option:selected').val();
    var $area = $('.JISYOU_LAYER_contents.wrap_edit').find('.keisoku_area').empty();
    var v_key = 'cd_keisoku';
    var t_key = 'keisoku';
    var html = '<table>';
    $.each(JISYOU_LAYER.edit.select.keisoku, function (i, v) {
        for (var n in filter) {
            if ((n in v) && filter[n] != v[n]) {
                return true;
            }
        }
        var vv = v[v_key];
        var vt = v[t_key];
        var require = false;
//         if (filter.cd_sisetu == JISYOU_LAYER.edit.require.SISETU_DOURO && filter.cd_bunrui == JISYOU_LAYER.edit.require.BUNRUI_SYADOU && vt == JISYOU_LAYER.edit.require.KEISOKU_SYASEN) {
//             require = true;
//         }
        html += '<tr><td><span class="text">'+vt+'</span></td><td><input type="text" name="'+v_key+'_'+vv+'" '+(require ? 'required' : '')+'>'+(require ? '　<span class="red">※必須入力</span>' : '')+'</td></tr>';
    });
    html += '</table>';
    $(html).appendTo($area);
}

/**
 * 措置作業方針セレクト作成
 */
JISYOU_LAYER.edit.makeTaiou = function () {
    var $select = JISYOU_LAYER.edit.makeSelect(JISYOU_LAYER.edit.select.taiou, 'taiou', 'taiou', 'taiou');
    var $taiou = $('.JISYOU_LAYER_contents.wrap_edit').find('.taiou');
    if ($taiou.is('select')) {
        $taiou.prepend('<option value="" selected></option>');
    }
    return $select;
}


/**
 * イベント
 */
JISYOU_LAYER.edit.setEvent = function () {
	var $wrap = $('.JISYOU_LAYER_contents.wrap_edit');
	// 毎回HTMLが作成されるため、毎回イベントをつける
// 	// イベント二重登録回避
// 	if ($wrap.hasClass('event')) {
// 		return;
// 	}
// 	$wrap.addClass('event');
	// 事務所選択
    $wrap.find('.kikan2').on('change', function () {
        JISYOU_LAYER.edit.makeKikan3Select();
        JISYOU_LAYER.edit.makeRoadSelect();
    });
    
    // 出張所洗濯
    $wrap.find('.kikan3').on('change', function () {
        JISYOU_LAYER.edit.makeRoadSelect();
    });
    
    // 事象区分選択
    $wrap.find('.kbn').on('change', function () {
        JISYOU_LAYER.edit.makeSisetuSelect();
        JISYOU_LAYER.edit.makeBunruiSelect();
        JISYOU_LAYER.edit.makeTaisyouSelect();
        JISYOU_LAYER.edit.makeJokyouSelect();
        JISYOU_LAYER.edit.makeSyotiSelect();
        JISYOU_LAYER.edit.makeKeisoku();
    });
    // 施設選択
    $wrap.find('.sisetu').on('change', function () {
        JISYOU_LAYER.edit.makeBunruiSelect();
        JISYOU_LAYER.edit.makeTaisyouSelect();
        JISYOU_LAYER.edit.makeJokyouSelect();
        JISYOU_LAYER.edit.makeSyotiSelect();
        JISYOU_LAYER.edit.makeKeisoku();
    });
    // 分類選択
    $wrap.find('.bunrui').on('change', function () {
        JISYOU_LAYER.edit.makeTaisyouSelect();
        JISYOU_LAYER.edit.makeJokyouSelect();
        JISYOU_LAYER.edit.makeSyotiSelect();
        JISYOU_LAYER.edit.makeKeisoku();
    });
    // 対象選択
    $wrap.find('.taisyou').on('change', function () {
        JISYOU_LAYER.edit.makeJokyouSelect();
        JISYOU_LAYER.edit.makeSyotiSelect();
        JISYOU_LAYER.edit.makeKeisoku();
    });
    // 状況選択
    $wrap.find('.jokyou').on('change', function () {
        JISYOU_LAYER.edit.makeKeisoku();
    });
    
    // 写真移動
    $wrap.find('.photo_area').on('click', '.prev', function(){
    	var $box = $(this).closest('.photo_box');
    	$box.prev().before($box);
    	JISYOU_LAYER.edit.updatePhotoData();
    });
    $wrap.find('.photo_area').on('click', '.next', function(){
    	var $box = $(this).closest('.photo_box');
    	$box.next().insertBefore($box);
    	JISYOU_LAYER.edit.updatePhotoData();
    });
    // 写真削除
    $wrap.find('.photo_area').on('click', '.delete', function(){
    	var $box = $(this).closest('.photo_box');
    	$box.remove();
    	JISYOU_LAYER.edit.updatePhotoData();
    });
    // 写真追加
    $wrap.find('.addphoto').on('click', function(){
    	var $inp = $wrap.find('.photo_input');
    	$inp.trigger('click');
    });
    // 画像追加イベント
    $wrap.find('.photo_input').on('change', function(){
    	var file = this.files[0];
    	if (file.type.indexOf('image') < 0) {
    		return;
    	}
    	var reader = new FileReader();
    	reader.onload = (function(file){
    		return function(e) {
    			var src = e.target.result;
    			EXIF.getData(file, function(){
    				var date = null;
    				var dts = EXIF.getTag(this, 'DateTimeOriginal');
    				if (dts) {
    					// YYYY:mm:dd hh:ii:ss --> YYYY/mm/dd hh:ii:ss
    					var dts_sp = dts.split(' ');
    					dts_sp[0] = dts_sp[0].replace(/:/g, '/');
    					dts = dts_sp.join(' ');
    					date = new Date(dts);
    					if (isNaN(date.getTime())) {
    						date = null;
    					}
    				}
    				if (!date) {
    					date = this.lastModifiedDate;
    				}
    				if (!date) {
    					date = new Date();
    				}
	    			JISYOU_LAYER.edit.data.photo.push({src: src, bikou: JISYOU_LAYER.date2str(date, 12), ix: (new Date()).getTime(), file: file, name: file.name});
	    			JISYOU_LAYER.edit.showPhotoData(JISYOU_LAYER.edit.data);
    			});
    		};
    	})(file);
    	reader.readAsDataURL(file);
    });
    
    // 対応ラジオボタン
    $wrap.find('.syotizumi').on('change', function(){
    	var checked = $(this).prop('checked');
    	var $target = $wrap.find('.taiou').add($wrap.find('.date_syoti')).add($wrap.find('.taiou_bikou'));
    	$target.prop('disabled', checked);
    });
    
    
    // 更新
    $wrap.find('.regist').on('click', JISYOU_LAYER.edit.registData);
    
    // 削除
    $wrap.find('.delete').on('click', JISYOU_LAYER.edit.deleteData);
    
    // 地図クリックによる事象位置設定
    map.on('click', JISYOU_LAYER.edit.clickLonLat);
};

/**
 * イベント解除
 */
JISYOU_LAYER.edit.unsetEvent = function () {
	var $wrap = $('.JISYOU_LAYER_contents.wrap_edit');
	// 事務所選択
    $wrap.find('.kikan2').off('change');
    
    // 出張所洗濯
    $wrap.find('.kikan3').off('change');
    
    // 事象区分選択
    $wrap.find('.kbn').off('change');
    // 施設選択
    $wrap.find('.sisetu').off('change');
    // 分類選択
    $wrap.find('.bunrui').off('change');
    // 対象選択
    $wrap.find('.taisyou').off('change');
    // 状況選択
    $wrap.find('.jokyou').off('change');
    
    // 写真
    $wrap.find('.photo_area').off('click');
    // 写真追加
    $wrap.find('.addphoto').off('click');
    // 画像追加イベント
    $wrap.find('.photo_input').off('change');
    
    // 対応ラジオボタン
    $wrap.find('.syotizumi').off('change');
    
    
    // 更新
    $wrap.find('.regist').off('click');
    
    // 削除
    $wrap.find('.delete').off('click');
    
    // 地図クリックによる事象位置設定
    map.un('click', JISYOU_LAYER.edit.clickLonLat);
    
    // 事象位置仮置きを削除
    if (JISYOU_LAYER.edit.temp_feature) {
        JISYOU_LAYER.layer.getSource().removeFeature(JISYOU_LAYER.edit.temp_feature);
        JISYOU_LAYER.edit.temp_feature = null;
    }
};

/**
 * 地図クリック時に事象位置を更新する関数
 */
JISYOU_LAYER.edit.clickLonLat = function (e) {
	var pos = e.coordinate;
	pos = ol.proj.transform(pos, 'EPSG:3857', 'EPSG:4326');
	JISYOU_LAYER.edit.updateLonLat([pos], JISYOU_LAYER.edit.data.jisyou_type);
};


/**
 * テキスト入力欄のサイズ設定
 */
JISYOU_LAYER.edit.setTextLength = function () {
	for (var name in JISYOU_LAYER.edit.text_length) {
		var length = JISYOU_LAYER.edit.text_length[name];
		var $e = $('.JISYOU_LAYER_contents.wrap_edit').find('.' + name);
		if ($e.length) {
			$e.prop('maxLength', length);
		}
	}
}

/**
 * 画像データ変数を更新する関数
 */
JISYOU_LAYER.edit.updatePhotoData = function () {
	var data = [];
	$('.JISYOU_LAYER_contents.wrap_edit').find('.photo_area').find('.photo_box').each(function(){
		var $$ = $(this);
		var ix = $$.data('ix');
		for (var i = 0, ilen = JISYOU_LAYER.edit.data.photo.length; i < ilen; ++i) {
			var dt = JISYOU_LAYER.edit.data.photo[i];
			if (ix == dt.ix) {
				dt.photo_type = $$.find('.type').val();
				dt.bikou = $$.find('.bikou').val();
				data.push(dt);
				break;
			}
		}
	});
	JISYOU_LAYER.edit.data.photo = data;
}

/**
 * 座標更新
 */
JISYOU_LAYER.edit.updateLonLat = function (points, jisyou_type) {
	if (points.length == 0) {
		return;
	}
	JISYOU_LAYER.edit.data.jisyou_type = jisyou_type;
	JISYOU_LAYER.edit.data.longitude = points[0][0];
	JISYOU_LAYER.edit.data.latitude = points[0][1];
	if (jisyou_type == 1) {
		JISYOU_LAYER.edit.data.point = [];
	} else {
		var ps = [];
		for (var i = 1, ilen = points.length; i < ilen; ++i) {
			var p = points[i];
			ps.push({longitude: p[0], latitude: p[1]});
		}
		JISYOU_LAYER.edit.data.point = ps;
	}
	var coord = JISYOU_LAYER.normalize('coordinate', JISYOU_LAYER.edit.data);
	$('.JISYOU_LAYER_contents.wrap_edit').find('.coordinate').html(coord);
	$('.JISYOU_LAYER_contents.wrap_edit').find('.jisyou_type').val(jisyou_type);
	$('.JISYOU_LAYER_contents.wrap_edit').find('.longitude').val(points[0][0]);
	$('.JISYOU_LAYER_contents.wrap_edit').find('.latitude').val(points[0][1]);
	
	if (JISYOU_LAYER.edit.temp_feature) {
		JISYOU_LAYER.layer.getSource().removeFeature(JISYOU_LAYER.edit.temp_feature);
	}
	var geom = new ol.geom.Point(points[0]);
	geom.transform('EPSG:4326', 'EPSG:3857');
	var feature = new ol.Feature(geom);
	feature.setProperties({display: 1, icon: JISYOU_LAYER.imgPath + 'point.png'});
	JISYOU_LAYER.layer.getSource().addFeature(feature);
	JISYOU_LAYER.edit.temp_feature = feature;
	
	//JISYOU_LAYER.edit.updatePosi();
}

/**
 * DBから地先名を取得する関数
 */
JISYOU_LAYER.edit.updatePosi = function () {
	var lon = JISYOU_LAYER.edit.data.longitude;
	var lat = JISYOU_LAYER.edit.data.latitude;
	var kikan2 = $('.JISYOU_LAYER_contents.wrap_edit').find('.kikan2').val();
	var kikan3 = $('.JISYOU_LAYER_contents.wrap_edit').find('.kikan3').val();
	$.ajax({
		url: JISYOU_LAYER.apiPath + 'getPosi.php',
		type: 'get',
		data: {lon: lon, lat: lat, kikan2: kikan2, kikan3: kikan3},
		dataType: 'json',
	}).done(function(data){
		if (data.adr && $('.JISYOU_LAYER_contents.wrap_edit').find('.tisaki').val() == '') {
			$('.JISYOU_LAYER_contents.wrap_edit').find('.tisaki').val(data.adr);
		}
	});
}

/**
 * 編集データ取得
 */
JISYOU_LAYER.edit.getEditData = function () {
	var data = {};
	
	var err = null;
	
	// input, select, textarea
	$('input,select,textarea').filter('[name]').each(function(){
		var $$ = $(this);
		var id = $$.attr('name');
		var val = $$.val();
		if (id == 'syotizumi') {
			val = $$.prop('checked') ? 0 : 1;
		}
		data[id] = val;
	});
	
	// 凡例
	var h = $('.JISYOU_LAYER_contents.wrap_edit').find('.taisyou').find('option:selected').data('hanrei');
	data.hanrei = h == null ? null : h;
	
	// 処置タイプ
	data.syoti_type = $('.JISYOU_LAYER_contents.wrap_edit').find('.syoti').find('option:selected').data('type');
	
	// 座標
	data.point = JISYOU_LAYER.edit.data.point;
	
	// 画像
	JISYOU_LAYER.edit.updatePhotoData();
	data.photo = JISYOU_LAYER.edit.data.photo;
	
	// 計測
	var $inp = $('.JISYOU_LAYER_contents.wrap_edit').find('.keisoku_area').find('input');
	data.keisoku = $inp.map(function(){
		var $$ = $(this);
		var k = $$.attr('name').split('_').pop();
		var val = $$.val();
		if ($$.attr('required') && val == '') {
			err = '車線は必須項目です。';
		}
		return [k, val].join(',');
	}).get();
	
	// 巡回中の番号
	if (JISYOU_LAYER.junkai && JISYOU_LAYER.junkai.tracking_no) {
		data.no_junkai = JISYOU_LAYER.junkai.tracking_no;
	}
	// 巡回データに後付け
	if (JISYOU_LAYER.junkai && JISYOU_LAYER.junkai.no_junkai) {
		data.no_junkai = JISYOU_LAYER.junkai.no_junkai;
		JISYOU_LAYER.junkai.no_junkai = 0;
	}
	
	if (!err) {
		err = JISYOU_LAYER.edit.checkEditData(data);
	}
	if (err) {
		alert(err);
		return null;
	}
	
	return data;
}

/**
 * 登録データが正しいかどうかのチェック
 */
JISYOU_LAYER.edit.checkEditData = function (data) {
	// 施設、分類、対象、状況
	if (data.sisetu == '' || data.bunrui == '' || data.taisyou == '' || data.jokyou == '') {
		return '施設、分類、対象、状況を入力して下さい。';
	}
	// 発見日時
	var date = new Date(data.date);
	if (isNaN(date.getTime())) {
		return '正しい日時を指定して下さい。';
	}
	// 座標
	if (isNaN(data.longitude) || isNaN(data.latitude)) {
		return '位置を指定して下さい。';
	}
	// 備考文字列チェック
	if (data.bikou.length > JISYOU_LAYER.edit.text_length.bikou) {
		return '備考は300文字までです。';
	}
	
}

/**
 * データを更新する関数
 */
JISYOU_LAYER.edit.registData = function () {
	var data = JISYOU_LAYER.edit.getEditData();
	if (!data) {
		return;
	}
	var formdata = new FormData();
	for (var n in data) {
		var v = data[n];
		if (n == 'keisoku') {
			// 計測
			for (var i = 0, ilen = v.length; i < ilen; ++i) {
				formdata.append('keisoku[]', v[i]);
			}
		} else if (n == 'point') {
			// 座標
			for (var i = 0, ilen = v.length; i < ilen; ++i) {
				formdata.append('point[]', [v[i].longitude, v[i].latitude].join(','));
			}
		} else if (n == 'photo') {
			// 画像
			for (var i = 0, ilen = v.length; i < ilen; ++i) {
				var p = v[i];
				if (p.file) {
					formdata.append('photo_file_' + i, p.file);
					formdata.append('photo_name_' + i, p.name);
				}
				formdata.append('photo_bikou_' + i, p.bikou);
				formdata.append('photo_type_' + i, p.photo_type);
				formdata.append('photo_ix_' + i, p.ix);
			}
		} else {
			// その他
			formdata.append(n, v);
		}
	}
	
	if (window.confirm('登録します。よろしいですか？')) {
	
		$.ajax({
			url: JISYOU_LAYER.apiPath + 'registJisyou_lax.php',
			type: 'post',
			data: formdata,
			contentType: false,
			processData: false,
			dataType: 'json',
		}).done(function(result){
			if (result.result == 1) {
				alert('登録しました。');
				if (JISYOU_LAYER.edit.end_func) {
					JISYOU_LAYER.edit.end_func();
				} else {
					sidebox_close();
				}
				JISYOU_LAYER.overlay.setPosition(undefined);
				//JISYOU_LAYER.update();
				JISYOU_LAYER.autoUpdate();
			} else {
				alert('登録に失敗しました。');
			}
		}).fail(function(){
			alert('登録に失敗しました。');
		});
	}
}

/**
 * データ削除
 */
JISYOU_LAYER.edit.deleteData = function () {
	if (confirm('削除します。よろしいですか？')) {
		$.ajax({
			url: JISYOU_LAYER.apiPath + 'deleteJisyou_lax.php',
			type: 'post',
			data: {no: JISYOU_LAYER.edit.data.no},
			dataType: 'json',
		}).done(function(result){
			if (result.result == 1) {
				alert('削除しました。');
				if (JISYOU_LAYER.edit.end_func) {
					JISYOU_LAYER.edit.end_func();
				} else {
					sidebox_close();
				}
				JISYOU_LAYER.overlay.setPosition(undefined);
				//JISYOU_LAYER.update();
				JISYOU_LAYER.autoUpdate();
			} else {
				alert('削除に失敗しました。');
			}
		}).fail(function(){
			alert('削除に失敗しました。');
		});
	}
}


/**
 * selectを作成する関数
 * @param array arr select作成用データ
 * @param string id selectのID
 * @param string v_key optionのvalueに使用するキー
 * @param string t_key optionのテキストに使用するキー
 * @param object filter 表示内容をフィルタするためのオブジェクト
 * @param string prefix selectの先頭に付与するoptionのテキスト
 */
JISYOU_LAYER.edit.makeSelect = function (arr, id, v_key, t_key, filter, prefix) {
    filter = filter || {};
    var $select = $('.JISYOU_LAYER_contents.wrap_edit').find('.'+id).empty();
    if ($select.length == 0) {
        $select = $('<select></select>').addClass(id);
    }
    if (prefix != null) {
        $('<option value="">'+prefix+'</option>').appendTo($select);
    }
    $.each(arr, function (i, v) {
        for (var n in filter) {
            if ((n in v) && filter[n] != v[n]) {
                return true;
            }
        }
        var vv = v[v_key];
        var vt = v[t_key];
        $('<option value="'+vv+'">'+vt+'</option>').appendTo($select);
    });
    // 更新
    $select[0].multiple = !($select[0].multiple = !$select[0].multiple);
    
    return $select;
}

/**
 * 編集用画像HTMLを作成する関数
 */
JISYOU_LAYER.edit.makePhotoHTMLEdit = function (data) {
	var query = $.param({no: data.no, ix: data.ix});
	var file = 'get_image.php?' + query;
	var photo_select_data = [{value: 3, text: '写真'}, {value: 4, text: 'その他'}];
	var $select = JISYOU_LAYER.edit.makeSelect(photo_select_data, 'photo_select', 'value', 'text');
	$select.attr('id', null);
	$select.addClass('type');
	$select.val(data.photo_type);
	var select = $select[0].outerHTML;
	
	if (data.photo_data) {
		file = 'data:image/' + data.photo_type + ';base64,' + data.photo_data;
	}
	if (data.src) {
		file = data.src;
	}
	
	var html = '<div class="photo_box" data-ix="'+data.ix+'">'
//	         + '<div class="center"><span class="daihyo">代表写真</span><span class="nissi">巡回日誌</span></div>'
	         + '<div class="center"><button class="prev">前へ</button> <button class="next">後へ</button></div>'
	         + '<div><img src="' + file + '" width="200" class="photo"></div>'
	         + '<div>' + select + '</div>'
	         + '<div><input type="text" class="bikou" value="' + data.bikou + '"></div>'
	         + '<div class="center"><button class="delete">削除</button></div>'
	         + '</div>';
	
	return html;
	
}



/*********************************************************************/
// メニュー

/**
 * ボタン押下
 */
JISYOU_LAYER.clickButton = function (e) {
	// ボタンエフェクト
	var $$ = $(this);
	$$.toggleClass('on');
	if ($$.hasClass('single')) {
		setTimeout(function(){
			$$.toggleClass('on');
		}, 100);
	}
	
	// 表示設定
	if ($$.data('action') == 'filter_item') {
		JISYOU_LAYER.updateFilter.call(this);
	}
	
	// 一覧ページ移動
	if ($$.data('action') == 'pagemove') {
		var page = $$.data('page');
		var $wrap = $$.closest('.pagemove');
		var first = $wrap.find('.first').data('page');
		var last  = $wrap.find('.last').data('page');
		if (page < first) {page = first;}
		if (page > last ) {page = last;}
		
		var stm = $$.data('stm');
		var etm = $$.data('etm');
		
		JISYOU_LAYER.updateList(page || 0, stm, etm);
	}
	
	// 詳細
	if ($$.data('action') == 'detail') {
		var no = $$.data('no');
		JISYOU_LAYER.showPopup(no);
// 		JISYOU_LAYER.showDetail(no);
		// ほかの選択を解除
		$$.closest('.list_area').find('.card').not($$).removeClass('on');
	}
	
// 	// ボタンアクション
// 	if ($$.hasClass('edit')) {
// 		// 事象登録
// 	} else {
// 		// 表示設定
// 		JISYOU_LAYER.updateFilter.call(this);
// 	}
};

/**
 * フィルタ更新
 */
JISYOU_LAYER.updateFilter = function () {
	var filter = {};
	$(this).closest('.filter').find('.button').each(function(){
		var $btn = $(this);
		var name = $btn.attr('name');
		var value = parseFloat($btn.val());
		if (!filter[name]) {
			filter[name] = [];
		}
		if ($btn.hasClass('on')) {
			filter[name].push(value);
		}
	});
	JISYOU_LAYER.filter = filter;
	JISYOU_LAYER.applyFilter();
};

// メニュー要素
JISYOU_LAYER.menu_html = '<div class="JISYOU_LAYER_contents">';


JISYOU_LAYER.menu_html += ''
                       + '<div class="menu">'
                       + ' '
                       + ' <!-- 巡回実施 -->'
                       + ' <fieldset>'
                       + '  <legend>巡回実施</legend>'
                       + '  <button class="button single" data-action="tujo_junkai">通常巡回</button>'
                       + '  <button class="button single" data-action="saigai_junkai">災害巡回<br>（地震等）</button>'
                       // 管理者の場合は登録可
                       + (JISYOU_LAYER.isAdmin ? '  <button class="button single" data-action="edit">事象登録<br>（行政相談等）</button>' : '')
                       + ' </fieldset>'
                       + ' '
                       + ' <!-- 巡回日誌 -->'
                       + ' <fieldset>'
                       + '  <legend>巡回日誌</legend>'
                       + '  <button class="button single" data-action="nissi">巡回日誌の表示</button>'
                       + ' </fieldset>'
                       + ' '
                       + ' <!-- その他 -->'
                       + ' <fieldset>'
                       + '  <legend>その他</legend>'
                       + '  <button class="button single" data-action="kiroku">巡回記録の修正</button>'
//                        + '  <button class="button single invalid">巡回記録の保存</button>'
                       + '  <button class="button single" data-action="hikitugi">引き継ぎメモ作成</button>'
                       + '  <button class="button single" data-action="list">事象一覧</button>'
                       + '  <button class="button single" data-action="filter">事象表示設定</button>'
                       + ' </fieldset>'
                       + ' '
                       + '</div>';

JISYOU_LAYER.menu_html += '</div>';



// メニュー追加
main_menu.app.menu.JISYOU_LAYER_menu = {
	click: function(){
		JISYOU_LAYER.sidebox_show(JISYOU_LAYER.menu_html, null, function(){
			JISYOU_LAYER.history = [];
		});
	},
	icon : 'images/menu_jisyou.png'
};

/**
 * メニューボタンクリック
 */
JISYOU_LAYER.clickMenuButton = function (e) {
	var $$ = $(this);
	var action = $$.data('action');
	switch (action) {
		// 事象登録
		case 'edit': 
			JISYOU_LAYER.clickEditBtn();
			break;
		// ダウンロード
		case 'download':
			var href = $$.data('href');
			var name = $$.data('name');
			var $a = $('<a>test</a>').prop('href', href).prop('download', name);
			var evt = document.createEvent( "MouseEvents" ); // マウスイベントを作成
			evt.initEvent( "click", false, true ); // イベントの詳細を設定
			$a[0].dispatchEvent( evt );
			break;
		// 事象一覧
		case 'list':
			JISYOU_LAYER.showList();
			break;
		// 事象フィルタ
		case 'filter':
			JISYOU_LAYER.showFilter();
			break;
		// 通常巡回
		case 'tujo_junkai':
			JISYOU_LAYER.junkai.saigai = 0;
			JISYOU_LAYER.junkai.init();
			break;
		// 災害巡回
		case 'saigai_junkai':
			JISYOU_LAYER.junkai.saigai = 1;
			JISYOU_LAYER.junkai.init();
			break;
		// 巡回日誌
		case 'nissi':
			JISYOU_LAYER.junkai.getDataNissi();
			break;
		// 引き継ぎメモ作成
		case 'hikitugi':
			JISYOU_LAYER.getHikitugi();
			break;
		// 巡回記録編集
		case 'kiroku':
			JISYOU_LAYER.junkai.getDataJunkaiKiroku();
			break;
	}
};

/**
 * 事象一覧を開く
 */
JISYOU_LAYER.showList = function () {
	JISYOU_LAYER.updateList(0);
};

/**
 * 事象一覧ページを開く
 */
JISYOU_LAYER.updateList = function (page, stm, etm, _retry) {
	page = page || 0;
	if (!stm) {
		var edate = new Date();
		var sdate = new Date();
		sdate.setDate(sdate.getDate() - 31);
		stm = JISYOU_LAYER.date2str(sdate, 11);
		etm = JISYOU_LAYER.date2str(edate, 11);
	}
	if (JISYOU_LAYER.ajax_store.updateList) {
		JISYOU_LAYER.ajax_store.updateList.abort();
	}
	JISYOU_LAYER.ajax_store.updateList = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJisyouList_lax.php',
		type: 'get',
		data: {page: page, stm: stm, etm: etm},
		cache: false,
		dataType: 'JSON'
	}).done(function(data){
		JISYOU_LAYER.showListData(data, stm, etm)
	}).fail(function(xhr, status){
		if (status != 'abort' && !_retry) {
			JISYOU_LAYER.updateList(page, true);
		}
	});
};

/**
 * 事象一覧を表示
 */
JISYOU_LAYER.showListData = function (data, stm, etm) {
	var area = [];
	for (var i = 0, ilen = data.data.length; i < ilen; ++i) {
		var dt = data.data[i];
		var h = ''
		      // 番号
		      + '<div class="item">' 
		      + JISYOU_LAYER.normalize('code', dt) 
		      + '</div>'
		      // 日時
		      + '<div class="item">' 
		      + JISYOU_LAYER.normalize('date', dt) 
		      + '</div>'
		      // 地先
		      + '<div class="item">' 
		      + JISYOU_LAYER.normalize('tisaki', dt) 
		      + '</div>'
		      // 施設＞分類＞対象＞状況
		      + '<div class="item">'
		      + JISYOU_LAYER.normalize('sisetu', dt) + '<br>'
		      + JISYOU_LAYER.normalize('bunrui', dt) + '<br>'
		      + JISYOU_LAYER.normalize('taisyou', dt) + '<br>'
		      + JISYOU_LAYER.normalize('jokyou', dt) + '<br>'
		      + '</div>'
		      // 災害処置
		      + '<div class="item">' 
		      + '災害：' + JISYOU_LAYER.normalize('saigai', dt) + ' '
		      + '処置：' + JISYOU_LAYER.normalize('syotizumi', dt) + ''
		      + '</div>'
		;
		
		var card = '<button class="card button" data-action="detail" data-no="'+dt.no+'">' + h + '</button>';
		area.push(card);
	}
	area = area.join('');
	
	// ページ
	var sp1 = data.page - 2;
	if (sp1 < 1) {sp1 = 1;}
	var ep1 = data.page + 2;
	if (ep1 > data.max) {ep1 = data.max;}
	var sp2 = ep1 - 4;
	if (sp2 < 1) {sp2 = 1;}
	var ep2 = sp1 + 4;
	if (ep2 > data.max) {ep2 = data.max;}
	
	var spage = Math.min(sp1, sp2);
	var epage = Math.max(ep1, ep2);
	
	var h = '';
	h += '<button class="button single first" data-action="pagemove" data-page="1" data-stm="'+stm+'" data-etm="'+etm+'">&lt;&lt;</button>'
	   + '<button class="button single" data-action="pagemove" data-page="'+(data.page-1)+'" data-stm="'+stm+'" data-etm="'+etm+'">&lt;</button>'
	;
	for (var p = spage; p <= epage; ++p) {
		var addcls = '';
		if (p == data.page) {
			addcls = 'here';
		}
		h += '<button class="button single '+addcls+'" data-action="pagemove" data-page="'+p+'" data-stm="'+stm+'" data-etm="'+etm+'">'+p+'</button>'
	}
	h += '<button class="button single" data-action="pagemove" data-page="'+(data.page+1)+'" data-stm="'+stm+'" data-etm="'+etm+'">&gt;</button>'
	   + '<button class="button single last" data-action="pagemove" data-page="'+(data.max)+'" data-stm="'+stm+'" data-etm="'+etm+'">&gt;&gt;</button>'
	;
	
	var html = '<div class="JISYOU_LAYER_contents">'
	         + ' <input type="text" value="" data-stm="'+stm+'" data-etm="'+etm+'" class="jisyou_time">'
	         + ' <div class="pagemove">'+h+'</div>'
	         + ' <div class="list_area">'+area+'</div>'
	         + ' <div class="pagemove">'+h+'</div>'
	         + '</div>'
	;
	
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.unsetListEvent, JISYOU_LAYER.setListEvent);
};

/**
 * 事象一覧イベント
 */
JISYOU_LAYER.setListEvent = function () {
	// イベント
	$(document).on('change', '.JISYOU_LAYER_contents .jisyou_time', function(e, options){
		if (options) {
			var $$ = $(this);
			var stm = $$.data('stm');
			var etm = $$.data('etm');
			JISYOU_LAYER.updateList(0, stm, etm);
		}
	});
	// 日付範囲input
	JISYOU_LAYER.flatpickr_instance.jisyou = JISYOU_LAYER.junkai.setRangeInput('.JISYOU_LAYER_contents .jisyou_time');
};
JISYOU_LAYER.unsetListEvent = function () {
	$(document).off('change', '.JISYOU_LAYER_contents .jisyou_time');
	// イベント解除
	for (var i in JISYOU_LAYER.flatpickr_instance) {
		var instance = JISYOU_LAYER.flatpickr_instance[i];
		if (instance) {
			instance.destroy();
		}
	}
};


/**
 * 事象フィルタを開く
 */
JISYOU_LAYER.showFilter = function () {
	var html =' <div class="filter JISYOU_LAYER_contents">'
	         + '  <legend>表示設定</legend>'
	         + '  <fieldset name="saigai">'
	         + '   <legend>事象区分</legend>'
	         + '   <button class="button on" data-action="filter_item" name="saigai" value="0">通常</button>'
	         + '   <button class="button on" data-action="filter_item" name="saigai" value="1">災害</button>'
	         + '  </fieldset>'
	         + '  <fieldset name="syotizumi">'
	         + '   <legend>処置状況</legend>'
	         + '   <button class="button on" data-action="filter_item" name="syotizumi" value="0"><img src="images/zs00.png">未処置</button>'
	         + '   <button class="button on" data-action="filter_item" name="syotizumi" value="1"><img src="images/zm00.png">処置済</button>'
	         + '  </fieldset>'
	         + '  <fieldset name="hanrei">'
	         + '   <legend>種別</legend>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="1" ><img src="images/zs01.png"><img src="images/zm01.png"><span>舗装・路面</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="2" ><img src="images/zs02.png"><img src="images/zm02.png"><span>構造物</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="3" ><img src="images/zs03.png"><img src="images/zm03.png"><span>安全施設</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="4" ><img src="images/zs04.png"><img src="images/zm04.png"><span>排水</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="5" ><img src="images/zs05.png"><img src="images/zm05.png"><span>占用物件</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="6" ><img src="images/zs06.png"><img src="images/zm06.png"><span>落石・斜面</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="7" ><img src="images/zs07.png"><img src="images/zm07.png"><span>落下物</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="8" ><img src="images/zs08.png"><img src="images/zm08.png"><span>動物の死骸</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="9" ><img src="images/zs09.png"><img src="images/zm09.png"><span>工事</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="10"><img src="images/zs10.png"><img src="images/zm10.png"><span>交通状況</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="11"><img src="images/zs11.png"><img src="images/zm11.png"><span>苦情・要望</span></button>'
	         + '   <button class="button on" data-action="filter_item" name="hanrei" value="12"><img src="images/zs12.png"><img src="images/zm12.png"><span>その他</span></button>'
	         + '  </fieldset>'
	         + ' </div>'
	         + '</div>';
	JISYOU_LAYER.sidebox_show(html, null, function(){
		// 既存のフィルタを復帰
		var filter = JISYOU_LAYER.filter;
		if (filter) {
			var $wrap = $('.JISYOU_LAYER_contents.filter');
			for (var n in filter) {
				var $fieldset = $wrap.find('fieldset[name="'+n+'"]');
				$fieldset.find('.button').removeClass('on').filter(function(){
					var val = parseInt($(this).val(), 10);
					return $.inArray(val, filter[n]) != -1;
				}).addClass('on');
			}
		}
	});
};



// メニューイベント
$(document.body).on('click', '.JISYOU_LAYER_contents .button', JISYOU_LAYER.clickButton);
$(document.body).on('click', '.JISYOU_LAYER_contents .menu .button', JISYOU_LAYER.clickMenuButton);


/*********************************************************************/

// 座標登録サブモジュール
if (!JISYOU_LAYER.module) {
	JISYOU_LAYER.module = {};
}
JISYOU_LAYER.module.registerCoordinates = {};

// レイヤ
JISYOU_LAYER.module.registerCoordinates.layer_draw = null;

// 座標
JISYOU_LAYER.module.registerCoordinates.points = [];

// 座標登録種別
JISYOU_LAYER.module.registerCoordinates.type = 1;

// コントロール
JISYOU_LAYER.module.registerCoordinates.controls = [];

/**
 * 事象登録時の座標指定
 * @param array data 登録済みのデータ
 * @param int type 座標登録種別
 */
JISYOU_LAYER.module.registerCoordinates.add = function (data, type) {
	// 事象登録用レイヤ
	JISYOU_LAYER.module.registerCoordinates.makeLayer();
	// イベント設定
	JISYOU_LAYER.module.registerCoordinates.setEvent();
	
	if (data) {
		// 初期値
		JISYOU_LAYER.module.registerCoordinates.points = data;
		JISYOU_LAYER.module.registerCoordinates.type = type;
		// 初期描画
		JISYOU_LAYER.module.registerCoordinates.redraw();
	}
	
	// コントロール
	JISYOU_LAYER.module.registerCoordinates.controls = [
		new JISYOU_LAYER.module.registerCoordinates.JisyoTypeControl({type: JISYOU_LAYER.module.registerCoordinates.type}),
		new JISYOU_LAYER.module.registerCoordinates.ProcessControl(),
	];
	for (var i = 0, ilen = JISYOU_LAYER.module.registerCoordinates.controls.length; i < ilen; ++i) {
		map.addControl(JISYOU_LAYER.module.registerCoordinates.controls[i]);
	}
	
};

/**
 * 事象登録モジュール削除
 */
JISYOU_LAYER.module.registerCoordinates.remove = function () {
	map.removeLayer(JISYOU_LAYER.module.registerCoordinates.layer);
	JISYOU_LAYER.module.registerCoordinates.unsetEvent();
	for (var i = 0, ilen = JISYOU_LAYER.module.registerCoordinates.controls.length; i < ilen; ++i) {
		map.removeControl(JISYOU_LAYER.module.registerCoordinates.controls[i]);
	}
};

/**
 * 座標登録用レイヤ作成
 */
JISYOU_LAYER.module.registerCoordinates.makeLayer = function () {
	var layer = new ol.layer.Vector({
		name: '事象登録',
		style: JISYOU_LAYER.module.registerCoordinates.createStyle,
		source: new ol.source.Vector(),
	});
	JISYOU_LAYER.module.registerCoordinates.layer = layer;
	map.addLayer(layer);
};

/**
 * 座標登録のスタイル
 */
JISYOU_LAYER.module.registerCoordinates.createStyle = function (feature, resolution) {
	var type = feature.getGeometry().getType();
	var cache_key = ['style', type];
	cache_key = cache_key.join('_');
	var style = JISYOU_LAYER.getCache(cache_key);
	if (!style) {
		style = [];
		if (type == 'LineString') {
		// 線のスタイル
			style.push(new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: 'blue',
					width: 2,
				}),
			}));
		} else if (type == 'Polygon') {
		// 面のスタイル
			style.push(new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: 'blue',
					width: 2,
				}),
				fill: new ol.style.Fill({
					color: 'rgba(0, 0, 255, 0.5)'
				}),
			}));
		}
		// 点のスタイル
		// 2点目以降
		style.push(new ol.style.Style({
			image: new ol.style.Circle({
				fill: new ol.style.Fill({color: 'orange'}),
				radius: 6,
			}),
			geometry: function (feature) {
				var coords = [];
				if (feature.getGeometry().getType() !== 'Polygon') {
					coords = feature.getGeometry().getCoordinates();
				} else {
					coords = feature.getGeometry().getCoordinates()[0];
				}
				coords.shift();
				return new ol.geom.MultiPoint(coords);
			},
		}));
		// 1点目
		style.push(new ol.style.Style({
			image: new ol.style.Circle({
				fill: new ol.style.Fill({color: 'blue'}),
				radius: 8,
			}),
			geometry: function (feature) {
				return new ol.geom.Point(feature.getGeometry().getFirstCoordinate());
			},
		}));
		// 保存
		JISYOU_LAYER.setCache(cache_key, style);
	}
	return style;
};

/**
 * 座標登録イベント
 */
JISYOU_LAYER.module.registerCoordinates.setEvent = function () {
	
	// 地図クリック
	map.on('click', JISYOU_LAYER.module.registerCoordinates.clickMap);
};

/**
 * 座標登録イベント解除
 */
JISYOU_LAYER.module.registerCoordinates.unsetEvent = function () {
	
	// 地図クリック
	map.un('click', JISYOU_LAYER.module.registerCoordinates.clickMap);
};

/**
 * 座標登録時のクリックイベント
 * @param object e クリックイベントオブジェクト。{coordinate: [***, ***]}
 */
JISYOU_LAYER.module.registerCoordinates.clickMap = function (e) {
	var point = ol.proj.transform(e.coordinate, JISYOU_LAYER.projection, JISYOU_LAYER.displayProjection);
	// 点を保存
	JISYOU_LAYER.module.registerCoordinates.points.push(point);
	// 点の場合
	if (JISYOU_LAYER.module.registerCoordinates.type == 1) {
		JISYOU_LAYER.module.registerCoordinates.points = [point];
	}
	JISYOU_LAYER.module.registerCoordinates.redraw();
};

/**
 * 座標指定を描画する関数
 */
JISYOU_LAYER.module.registerCoordinates.redraw = function () {
	var type = JISYOU_LAYER.module.registerCoordinates.type;
	// 描画
	if (type == 1) {JISYOU_LAYER.module.registerCoordinates.makePoint();}
	if (type == 2) {JISYOU_LAYER.module.registerCoordinates.makeLine();}
	if (type == 3) {JISYOU_LAYER.module.registerCoordinates.makePolygon();}

};

/**
 * 点描画
 */
JISYOU_LAYER.module.registerCoordinates.makePoint = function () {
	var features = [];
	var points = JISYOU_LAYER.module.registerCoordinates.points;
	var g = new ol.geom.MultiPoint(points);
	g.transform(JISYOU_LAYER.displayProjection, JISYOU_LAYER.projection);
	var f = new ol.Feature(g);
	features.push(f);
	var layer = JISYOU_LAYER.module.registerCoordinates.layer;
	layer.getSource().clear();
	layer.getSource().addFeatures(features);
};

/**
 * 線描画
 */
JISYOU_LAYER.module.registerCoordinates.makeLine = function () {
	var features = [];
	var points = JISYOU_LAYER.module.registerCoordinates.points;
	var g = new ol.geom.LineString(points);
	g.transform(JISYOU_LAYER.displayProjection, JISYOU_LAYER.projection);
	var f = new ol.Feature(g);
	features.push(f);
	var layer = JISYOU_LAYER.module.registerCoordinates.layer;
	layer.getSource().clear();
	layer.getSource().addFeatures(features);
};

/**
 * 面描画
 */
JISYOU_LAYER.module.registerCoordinates.makePolygon = function () {
	var features = [];
	var points = JISYOU_LAYER.module.registerCoordinates.points;
	var g = new ol.geom.Polygon([points]);
	g.transform(JISYOU_LAYER.displayProjection, JISYOU_LAYER.projection);
	var f = new ol.Feature(g);
	features.push(f);
	var layer = JISYOU_LAYER.module.registerCoordinates.layer;
	layer.getSource().clear();
	layer.getSource().addFeatures(features);
};

/**
 * 事象種別コントロール
 */
JISYOU_LAYER.module.registerCoordinates.JisyoTypeControl = function (opt_options) {
	var options = opt_options || {};
	
	var point = document.createElement('button');
	point.innerHTML = '点';
	point.setAttribute('data-type', 1);
	var line = document.createElement('button');
	line.innerHTML = '線';
	line.setAttribute('data-type', 2);
	var polygon = document.createElement('button');
	polygon.innerHTML = '面';
	polygon.setAttribute('data-type', 3);
	
	var element = document.createElement('div');
	element.className = 'JISYOU_LAYER jisyo-type ol-unselectable ol-control';
	element.appendChild(point);
	element.appendChild(line);
	element.appendChild(polygon);
	
	var buttons = element.querySelectorAll('button');
	for (var i = 0, ilen = buttons.length; i < ilen; ++i) {
		var button = buttons[i];
		if (button.getAttribute('data-type') == options.type) {
			button.className = 'on';
		}
	}
	
	var self = this;
	element.addEventListener('click', function(e){
		var b = e.target;
		if (b.nodeName.toLowerCase() == 'button') {
			for (var i = 0, ilen = buttons.length; i < ilen; ++i) {
				var button = buttons[i];
				button.className = '';
			}
			b.className = 'on';
			var type = b.getAttribute('data-type');
			JISYOU_LAYER.module.registerCoordinates.type = type;
			if (type == 1) {
				// 始点を使用
				if (JISYOU_LAYER.module.registerCoordinates.points.length) {
					JISYOU_LAYER.module.registerCoordinates.points = [JISYOU_LAYER.module.registerCoordinates.points[0]];
				}
				JISYOU_LAYER.module.registerCoordinates.makePoint();
			}
			if (type == 2) {JISYOU_LAYER.module.registerCoordinates.makeLine();}
			if (type == 3) {JISYOU_LAYER.module.registerCoordinates.makePolygon();}
		}
	});

	ol.control.Control.call(this, {
		element: element,
		target: options.target
	});
};
ol.inherits(JISYOU_LAYER.module.registerCoordinates.JisyoTypeControl, ol.control.Control);

/**
 * 操作コントロール
 */
JISYOU_LAYER.module.registerCoordinates.ProcessControl = function (opt_options) {
	var options = opt_options || {};
	
	var clear = document.createElement('button');
	clear.innerHTML = 'ｸﾘｱ';
	clear.setAttribute('data-type', 1);
	var regist = document.createElement('button');
	regist.innerHTML = '入力終了';
	regist.setAttribute('data-type', 2);
	var cancel = document.createElement('button');
	cancel.innerHTML = 'ｷｬﾝｾﾙ';
	cancel.setAttribute('data-type', 3);

	var element = document.createElement('div');
	element.className = 'JISYOU_LAYER process ol-unselectable ol-control';
	element.appendChild(clear);
	element.appendChild(regist);
	element.appendChild(cancel);

	var self = this;
	element.addEventListener('click', function(e){
		var b = e.target;
		if (b.nodeName.toLowerCase() == 'button') {
			var type = b.getAttribute('data-type');
			
			var jisyou_type = JISYOU_LAYER.module.registerCoordinates.type;
			// クリア
			if (type == 1) {
				JISYOU_LAYER.module.registerCoordinates.points = [];
				JISYOU_LAYER.module.registerCoordinates.redraw();
			}
			// 入力終了
			if (type == 2) {
				JISYOU_LAYER.module.registerCoordinates.remove();
			}
			// キャンセル
			if (type == 3) {
				JISYOU_LAYER.module.registerCoordinates.remove();
			}
		}
	});

	ol.control.Control.call(this, {
		element: element,
		target: options.target
	});
}
ol.inherits(JISYOU_LAYER.module.registerCoordinates.ProcessControl, ol.control.Control);


JISYOU_LAYER.docCookies = {
  getItem: function (sKey) {
    if (!sKey) { return null; }
    return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
  },
  setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
    var sExpires = "";
    if (vEnd) {
      switch (vEnd.constructor) {
        case Number:
          sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + vEnd;
          /*
          Note: Despite officially defined in RFC 6265, the use of `max-age` is not compatible with any
          version of Internet Explorer, Edge and some mobile browsers. Therefore passing a number to
          the end parameter might not work as expected. A possible solution might be to convert the the
          relative time to an absolute time. For instance, replacing the previous line with:
          */
          /*
          sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; expires=" + (new Date(vEnd * 1e3 + Date.now())).toUTCString();
          */
          break;
        case String:
          sExpires = "; expires=" + vEnd;
          break;
        case Date:
          sExpires = "; expires=" + vEnd.toUTCString();
          break;
      }
    }
    document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
    return true;
  },
  removeItem: function (sKey, sPath, sDomain) {
    if (!this.hasItem(sKey)) { return false; }
    document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "");
    return true;
  },
  hasItem: function (sKey) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
    return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
  },
  keys: function () {
    var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
    for (var nLen = aKeys.length, nIdx = 0; nIdx < nLen; nIdx++) { aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]); }
    return aKeys;
  }
};


/**
 * GPS座標を取得する関数
 */
JISYOU_LAYER.getPosition = function () {
	//if (window.GPSPosition) {
	//	return window.GPSPosition;
	//}
	if (users[myUid]) {
		return ol.proj.transform([users[myUid].lng,users[myUid].lat], 'EPSG:4326', 'EPSG:3857');
	}

	return map.getView().getCenter();
};

/**
 * GPS座標監視
 */
JISYOU_LAYER.startGPS = function () {
	JISYOU_LAYER.watchGPSID = navigator.geolocation.watchPosition(function(position){
		var coord = [position.coords.longitude, position.coords.latitude];
		window.GPSPosition = ol.proj.transform(coord, 'EPSG:4326', 'EPSG:3857');
	});
}

/**
 * sidebox表示時に共通の動作をする必要がある
 */
JISYOU_LAYER.sidebox_show = function (html, close_func, create_func) {
	// sidebox表示
	sidebox_show(html, close_func);
	// sidebox表示時の処理
	if (create_func) create_func();
	
	JISYOU_LAYER.history.push([html, close_func, create_func]);
	
	// 地図上のポップアップを消す
	if (JISYOU_LAYER.overlay) {
		JISYOU_LAYER.overlay.setPosition(undefined);
	}
	
};

/**
 * 巡回
 */

JISYOU_LAYER.junkai = {};

// 日付範囲input
JISYOU_LAYER.junkai.flatpickr_instance = {};

/**
 * 巡回初期設定
 */
JISYOU_LAYER.junkai.init = function () {
	// 巡回中
	if (JISYOU_LAYER.junkai.tracking_no) {
		JISYOU_LAYER.junkai.showKeiyutiList();
	} else {
		JISYOU_LAYER.junkai.makeLayer();
		if (JISYOU_LAYER.junkai.saigai) {
			JISYOU_LAYER.junkai.getDataSaigai();
		} else {
			JISYOU_LAYER.junkai.getData();
		}
	}
};

/**
 * 巡回用レイヤ作成
 */
JISYOU_LAYER.junkai.makeLayer = function () {
	if (!JISYOU_LAYER.junkai.layer) {
		var layer = new ol.layer.Vector({source: new ol.source.Vector(), style: JISYOU_LAYER.junkai.createTrackingStyle});
		map.addLayer(layer);
		JISYOU_LAYER.junkai.layer = layer;
	}
};

/**
 * イベント
 */
JISYOU_LAYER.junkai.setEvent = function () {
	$(document).on('click', '.JISYOU_LAYER_contents .card.button.plan', JISYOU_LAYER.junkai.getTrackingDetail);
	$(document).on('click', '.JISYOU_LAYER_contents .new_junkai', JISYOU_LAYER.junkai.getTrackingDetail);
	$(document).on('click', '.JISYOU_LAYER_contents .junkai_start', JISYOU_LAYER.junkai.askTracking);
	$(document).on('click', '.JISYOU_LAYER_contents .junkai_end', JISYOU_LAYER.junkai.endTracking);
	$(document).on('click', '.JISYOU_LAYER_contents .junkai_stop', JISYOU_LAYER.junkai.stopTracking);
	$(document).on('click', '.JISYOU_LAYER_contents .new_saigai', JISYOU_LAYER.junkai.askTrackingSaigai);
	$(document).on('click', '.JISYOU_LAYER_contents .card.button.saigai', JISYOU_LAYER.junkai.askTrackingSaigai);
	$(document).on('click', '.JISYOU_LAYER_contents .card.button.nissi', JISYOU_LAYER.junkai.getNissi);
	$(document).on('change', '.JISYOU_LAYER_contents .nissi_time', JISYOU_LAYER.junkai.changeNissiTime);
	$(document).on('click', '.JISYOU_LAYER_contents .card.button.kiroku', JISYOU_LAYER.junkai.getKirokuBridge);
	$(document).on('change', '.JISYOU_LAYER_contents .kiroku_time', JISYOU_LAYER.junkai.changeKirokuTime);
	$(document).on('click', '.JISYOU_LAYER_contents .junkai_edit', JISYOU_LAYER.junkai.editKiroku);
	$(document).on('click', '.JISYOU_LAYER_contents .jisyou', JISYOU_LAYER.junkai.editJisyou);
	$(document).on('click', '.JISYOU_LAYER_contents .new_jisyou', JISYOU_LAYER.junkai.newJisyou);
	$(document).on('click', '.JISYOU_LAYER_contents .pagemove.nissi .button', JISYOU_LAYER.junkai.changeNissiPage);
	$(document).on('click', '.JISYOU_LAYER_contents .pagemove.kiroku .button', JISYOU_LAYER.junkai.changeKirokuPage);
	
	// 日付範囲input
	JISYOU_LAYER.junkai.flatpickr_instance.nissi = JISYOU_LAYER.junkai.setRangeInput('.JISYOU_LAYER_contents .nissi_time');
	JISYOU_LAYER.junkai.flatpickr_instance.kiroku = JISYOU_LAYER.junkai.setRangeInput('.JISYOU_LAYER_contents .kiroku_time');
};
JISYOU_LAYER.junkai.unsetEvent = function () {
	$(document).off('click', '.JISYOU_LAYER_contents .card.button.plan', JISYOU_LAYER.junkai.getTrackingDetail);
	$(document).off('click', '.JISYOU_LAYER_contents .new_junkai', JISYOU_LAYER.junkai.getTrackingDetail);
	$(document).off('click', '.JISYOU_LAYER_contents .junkai_start', JISYOU_LAYER.junkai.askTracking);
	$(document).off('click', '.JISYOU_LAYER_contents .junkai_end', JISYOU_LAYER.junkai.endTracking);
	$(document).off('click', '.JISYOU_LAYER_contents .junkai_stop', JISYOU_LAYER.junkai.stopTracking);
	$(document).off('click', '.JISYOU_LAYER_contents .new_saigai', JISYOU_LAYER.junkai.askTrackingSaigai);
	$(document).off('click', '.JISYOU_LAYER_contents .card.button.saigai', JISYOU_LAYER.junkai.askTrackingSaigai);
	$(document).off('click', '.JISYOU_LAYER_contents .card.button.nissi', JISYOU_LAYER.junkai.getNissi);
	$(document).off('change', '.JISYOU_LAYER_contents .nissi_time', JISYOU_LAYER.junkai.changeNissiTime);
	$(document).off('click', '.JISYOU_LAYER_contents .card.button.kiroku', JISYOU_LAYER.junkai.getKirokuBridge);
	$(document).off('change', '.JISYOU_LAYER_contents .kiroku_time', JISYOU_LAYER.junkai.changeKirokuTime);
	$(document).off('click', '.JISYOU_LAYER_contents .junkai_edit', JISYOU_LAYER.junkai.editKiroku);
	$(document).off('click', '.JISYOU_LAYER_contents .jisyou', JISYOU_LAYER.junkai.editJisyou);
	$(document).off('click', '.JISYOU_LAYER_contents .new_jisyou', JISYOU_LAYER.junkai.newJisyou);
	$(document).off('click', '.JISYOU_LAYER_contents .pagemove.nissi .button', JISYOU_LAYER.junkai.changeNissiPage);
	$(document).off('click', '.JISYOU_LAYER_contents .pagemove.kiroku .button', JISYOU_LAYER.junkai.changeKirokuPage);
	
	for (var i in JISYOU_LAYER.junkai.flatpickr_instance) {
		var instance = JISYOU_LAYER.junkai.flatpickr_instance[i];
		if (instance) {
			instance.destroy();
		}
	}
};

/**
 * 巡回詳細取得
 */
JISYOU_LAYER.junkai.getTrackingDetail = function () {
	var $$ = $(this);
	var data = {};
	if ($$.hasClass('card')) {
		// 計画
		var no_plan = $$.data('no_plan');
		var no_junkai = $$.data('no_junkai');
		data = {no_plan: no_plan, no_junkai: no_junkai};
	} else {
		// 新規
		var $wrap = $$.closest('.junkai_plan_list');
		var route   = $wrap.find('select[name="route"]').val();
		var tantou1 = $wrap.find('select[name="tantou1"]').val();
		var tantou2 = $wrap.find('select[name="tantou2"]').val();
		var unten   = $wrap.find('select[name="unten"]').val();
		var juuten  = $wrap.find('input[name="juuten"]').val();
		var tenkou  = $wrap.find('input[name="tenkou"]').val();
		var tekiyou = $wrap.find('input[name="tekiyou"]').val();
		data = {route: route, tantou1: tantou1, tantou2: tantou2, unten: unten, juuten: juuten, tenkou: tenkou, tekiyou: tekiyou};
	}
	JISYOU_LAYER.ajax_store.junkai_data = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJunkaiData_lax.php',
		type: 'get',
		data: data,
		cache: false,
		dataType: 'json',
	}).done(JISYOU_LAYER.junkai.showTrackingDetail).fail(JISYOU_LAYER.junkai.errorData);
};

/**
 * 巡回詳細表示
 */
JISYOU_LAYER.junkai.showTrackingDetail = function (data) {
	JISYOU_LAYER.sidebox_show(data.html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
};

/**
 * 巡回開始してもいいかどうか
 */
JISYOU_LAYER.junkai.askTracking = function () {
	// 巡回中
	if (JISYOU_LAYER.junkai.tracking_no) {
		JISYOU_LAYER.junkai.showKeiyutiList();
	} else {
		var $$ = $(this);
		var data = $$.data();
		var date = $$.closest('.junkai_detail').find('.date').find('input').val();
		data.date = date;
		if (confirm('巡回を開始しますか？')) {
			$$.prop('disabled', true);
			JISYOU_LAYER.junkai.initTracking(data);
		}
	}
};

/**
 * 災害巡回開始してもいいかどうか
 */
JISYOU_LAYER.junkai.askTrackingSaigai = function () {
	// 巡回中
	if (JISYOU_LAYER.junkai.tracking_no) {
		JISYOU_LAYER.junkai.showKeiyutiList();
	} else {
		var $$ = $(this);
		var data = {};
		var no_junkai = $$.data('no_junkai');
		if (no_junkai) {
			data.no_junkai = no_junkai;
		} else {
			var $wrap = $$.closest('.junkai_plan_list');
			data.tantou1 = $wrap.find('[name="tantou1"]').val();
			data.tantou2 = $wrap.find('[name="tantou2"]').val();
			data.unten   = $wrap.find('[name="unten"]').val();
			data.juuten  = $wrap.find('input[name="juuten"]').val();
			data.tenkou  = $wrap.find('input[name="tenkou"]').val();
			data.tekiyou = $wrap.find('input[name="tekiyou"]').val();
			data.saigai  = 1;
			data.date    = JISYOU_LAYER.date2str(new Date(), 0);
		}
		if (confirm('巡回を開始しますか？')) {
			$$.prop('disabled', true);
			JISYOU_LAYER.junkai.initTracking(data);
		}
	}
};

/**
 * 巡回開始前処理
 */
JISYOU_LAYER.junkai.initTracking = function (data) {
	
	JISYOU_LAYER.junkai.layer.getSource().clear();
	
	JISYOU_LAYER.ajax_store.junkai_start = $.ajax({
		url: JISYOU_LAYER.apiPath + 'startJunkai_lax.php',
		data: data,
		cache: false,
		dataType: 'json',
	}).done(JISYOU_LAYER.junkai.setTrackingData)
	  .done(JISYOU_LAYER.junkai.showKeiyuti)
	  .done(JISYOU_LAYER.junkai.showKeiyutiList)
	  .done(JISYOU_LAYER.junkai.showKiseki)
	  .done(JISYOU_LAYER.junkai.tracking)
	  .fail(JISYOU_LAYER.junkai.errorData);
	
};

/**
 * 巡回データ設定
 */
JISYOU_LAYER.junkai.setTrackingData = function (data) {
	JISYOU_LAYER.junkai.tracking_no = data.no;
}

/**
 * 経由地リスト表示
 */
JISYOU_LAYER.junkai.showKeiyutiList = function () {
	var area = [];
	var features = JISYOU_LAYER.junkai.layer.getSource().getFeatures();
	for (var i = 0, ilen = features.length; i < ilen; ++i) {
		var data = features[i].getProperties();
		if (!data.ind_keiyuti) {
			continue;
		}
		var ind = data.ind_keiyuti;
		var text = data.keiyuti;
		var date = '';
		if (data.date) {
			date = new Date(data.date);
			date = JISYOU_LAYER.date2str(date, 5);
		}
		var cls = '';
		if (data.focus) {
			cls = 'focus';
		}
		if (data.visited) {
			cls = 'visited';
		}
		area[ind] = '<tr class="keiyuti ' + cls + '"><td>' + ind + '</td><td>' + text + '</td><td class="time">' + date + '</td></tr>';
	}
	area = area.join('');
	var html = '<div class="JISYOU_LAYER_contents junkai_detail">'
	         + (area ? ' 経由地' : '')
	         + ' <table class="list_area keiyuti">'+area+'</table>'
	         + ' <button class="button junkai_end">巡回終了</button>'
	         + ' <button class="button junkai_stop">中断</button>'
	         + '</div>'
	;
	
	// 履歴削除
	JISYOU_LAYER.history = [[JISYOU_LAYER.menu_html, null, function(){
		JISYOU_LAYER.history = [];
	}]];
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
};

/**
 * 経由地表示
 */
JISYOU_LAYER.junkai.showKeiyuti = function (data) {
	var json = data.keiyuti;
	var format = new ol.format.GeoJSON({
		featureProjection: JISYOU_LAYER.projection,
	});
	var features = format.readFeatures(json);
	
	// 初期地点
	var hit = false;
	for (var i = 0, ilen = features.length; i < ilen; ++i) {
		var ind = i + 1;
		for (var j = 0; j < ilen; ++j) {
			var feature = features[j];
			var data = feature.getProperties();
			if (data.ind_keiyuti == ind) {
				if (data.date) {
					data.visited = 1;
				} else if (!hit) {
					data.focus = 1;
					hit = true;
				}
				feature.setProperties(data);
			}
		}
	}
	
	JISYOU_LAYER.junkai.layer.getSource().clear();
	JISYOU_LAYER.junkai.layer.getSource().addFeatures(features);
	
};

/**
 * 軌跡表示
 */
JISYOU_LAYER.junkai.showKiseki = function (data) {
	var json = data.kiseki;
	var format = new ol.format.GeoJSON({
		featureProjection: JISYOU_LAYER.projection,
	});
	var features = format.readFeatures(json);
	
	JISYOU_LAYER.junkai.layer.getSource().addFeatures(features);
	
	if (features.length) {
		JISYOU_LAYER.junkai.tracking_line = features[0].getGeometry();
	} else {
		JISYOU_LAYER.junkai.tracking_line = null;
	}
};

/**
 * 巡回開始
 */
JISYOU_LAYER.junkai.tracking = function () {
	if (!JISYOU_LAYER.junkai.tracking_no) {
		return;
	}
	
	// 位置
	var point = JISYOU_LAYER.getPosition();
	var point4326 = ol.proj.transform(point, 'EPSG:3857', 'EPSG:4326');
	
	var date = new Date();
	date = JISYOU_LAYER.date2str(date, 0);
	
	// 経路線作成
	var g = JISYOU_LAYER.junkai.tracking_line;
	if (!g) {
		g = new ol.geom.LineString([point]);
		JISYOU_LAYER.junkai.layer.getSource().addFeature(new ol.Feature(g));
		JISYOU_LAYER.junkai.tracking_line = g;
	} else {
		g.appendCoordinate(point);
	}
	// 経由地接近データ
	var ret = JISYOU_LAYER.junkai.checkPoint(point, date);
	var end = (ret.check > 0) && !ret.next;
	// 軌跡保存
	JISYOU_LAYER.ajax_store.junkai_kiseki = $.ajax({
		url: JISYOU_LAYER.apiPath + 'setJunkaiKiseki_lax.php',
		type: 'post',
		data: {no: JISYOU_LAYER.junkai.tracking_no, lon: point4326[0], lat: point4326[1], check: ret.check, date: date},
	});
// 	// 巡回終了
// 	if (end) {
// 		JISYOU_LAYER.junkai.endTracking();
// 		return;
// 	}
	
	// ループ
	JISYOU_LAYER.junkai.trackingTimeoutID = setTimeout(function(){
		JISYOU_LAYER.junkai.tracking();
	}, 1000);
};

/**
 * 巡回経由地を通ったかどうか
 * @param array point 現在の座標
 * @param string date 現在時刻
 * @return object 通過状態を返す。{check: 経由地を通った場合の経由地インデックス, next: 次の地点があるかどうか}
 */
JISYOU_LAYER.junkai.checkPoint = function (point, date) {
	var features = JISYOU_LAYER.junkai.layer.getSource().getFeatures();
	var ind = 0;
	var hit = false;
	for (var i = 0, ilen = features.length; i < ilen; ++i) {
		var feature = features[i];
		var data = features[i].getProperties();
		if (data.focus && !data.visited) {
			// 100m以内の場合は通った判定
			var fpoint = feature.getGeometry().getCoordinates();
			var line = new ol.geom.LineString([point, fpoint]);
			var length = line.getLength();
			if (length < 100) {
				data.visited = 1;
				data.focus = 0;
				data.date = date;
				feature.setProperties(data);
				ind = data.ind_keiyuti;
				hit = true;
			}
			break;
		}
	}
	// 次地点
	var next_hit = false;
	if (hit) {
		var next_ind = ind + 1;
		for (var i = 0, ilen = features.length; i < ilen; ++i) {
			var feature = features[i];
			var data = features[i].getProperties();
			if (!data.focus && !data.visited && data.ind_keiyuti == next_ind) {
				data.focus = 1;
				feature.setProperties(data);
				next_hit = true;
				break;
			}
		}
// 		// 通過保存
// 		$.ajax({
// 			url: JISYOU_LAYER.apiPath + 'setJunkaiKeiyutiCheck_lax.php',
// 			type: 'post',
// 			data: {no: JISYOU_LAYER.junkai.tracking_no, ind: ind},
// 		});
		JISYOU_LAYER.junkai.showKeiyutiList();
	}
	return {check: ind, next: next_hit};
}

/**
 * 巡回終了
 */
JISYOU_LAYER.junkai.endTracking = function () {
	var date = new Date();
	date = JISYOU_LAYER.date2str(date, 0);
	
	if (JISYOU_LAYER.ajax_store.junkai_kiseki) {
		JISYOU_LAYER.ajax_store.junkai_kiseki.abort();
	}
	
	JISYOU_LAYER.ajax_store.junkai_end = $.ajax({
		url: JISYOU_LAYER.apiPath + 'endJunkai_lax.php',
		type: 'post',
		data: {no: JISYOU_LAYER.junkai.tracking_no, date: date},
	});
	
	JISYOU_LAYER.junkai.stopTracking();
	
	map.removeLayer(JISYOU_LAYER.junkai.layer);
	JISYOU_LAYER.junkai.layer = null;
};

/**
 * 巡回中断
 */
JISYOU_LAYER.junkai.stopTracking = function () {
	clearTimeout(JISYOU_LAYER.junkai.trackingTimeoutID);
	JISYOU_LAYER.junkai.tracking_no = 0;
	
	JISYOU_LAYER.junkai.layer.getSource().clear();
	
	sidebox_close();
};

/**
 * スタイル
 */
JISYOU_LAYER.junkai.createTrackingStyle = function (feature, resolution) {
	var data = feature.getProperties();
	var cache_key = ['junkai', data.ind_keiyuti, data.focus, data.visited];
	cache_key = cache_key.join('_');
	var style = JISYOU_LAYER.getCache(cache_key);
	if (!style) {
		if (data.ind_keiyuti) {
			// 背景色
			var bgcolor = 'yellow';
			var fgcolor = 'black';
			if (data.focus) {bgcolor = 'orange'; fgcolor = 'white';}
			if (data.visited) {bgcolor = 'gray'; fgcolor = 'white';}
			// zindex
			var index = 100 - data.ind_keiyuti;
			if (data.visited) {index = data.ind_keiyuti;}
			// style
			style = new ol.style.Style({
				image: new ol.style.RegularShape({
					fill: new ol.style.Fill({
						color: bgcolor,
					}),
					points: 4,
					angle: Math.PI / 4,
					radius: 15,
				}),
				text: new ol.style.Text({
					text: String(data.ind_keiyuti),
					font: '12pt Meiryo',
					fill: new ol.style.Fill({color: fgcolor}),
				}),
				zIndex: index,
			});
		} else {
			style = [
				new ol.style.Style({
					stroke: new ol.style.Stroke({
						width: 2,
						color: 'orange',
					}),
				}),
				new ol.style.Style({
					image: new ol.style.Icon({
						src: JISYOU_LAYER.imgPath + 'images/patrol-car-26px.png',
					}),
					geometry: function (feature) {
						var c = feature.getGeometry().getLastCoordinate();
						return new ol.geom.Point(c);
					},
				}),
			];
		}
		JISYOU_LAYER.setCache(cache_key, style);
	}
	return style;
};

/**
 * 巡回リスト
 */
JISYOU_LAYER.junkai.getData = function () {
	
	var now = new Date();
	var yy = now.getFullYear();
	var mm = now.getMonth() + 1;
	
	JISYOU_LAYER.ajax_store.junkai_planlist = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJunkaiPlanList_lax.php',
		type: 'get',
		data: {yy: yy, mm: mm},
		cache: false,
		dataType: 'json',
	}).done(JISYOU_LAYER.junkai.showData).fail(JISYOU_LAYER.junkai.errorData);
};

/**
 * 巡回計画データ取得エラー
 */
JISYOU_LAYER.junkai.errorData = function (e) {
	console.log(e);
};

/**
 * 巡回計画及び巡回中一覧
 */
JISYOU_LAYER.junkai.showData = function (data) {
	var area = [];
	for (var i = 0, ilen = data.data.length; i < ilen; ++i) {
		var dt = data.data[i];
// 		var h = ''
// 		      // 日時
// 		      + '<div class="item">' 
// 		      + JISYOU_LAYER.normalize('date', dt) 
// 		      + '</div>'
// 		      // 経路
// 		      + '<div class="item">' 
// 		      + JISYOU_LAYER.normalize('route', dt) 
// 		      + '</div>'
// 		      // 担当
// 		      + '<div class="item">'
// 		      + JISYOU_LAYER.normalize('tantou1', dt) + '<br>'
// 		      + JISYOU_LAYER.normalize('tantou2', dt) + '<br>'
// 		      + JISYOU_LAYER.normalize('unten', dt) + '<br>'
// 		      + '</div>'
// 		      // 区間
// 		      + '<div class="item">' 
// 		      + JISYOU_LAYER.normalize('kukan', dt) + ' '
// 		      + '</div>'
// 		;
		var h = '<table class="junkai_plan_list '+(dt.no_junkai ? 'tracking' : '')+'">'
		      + '<tr><td>巡回日</td><td>' + JISYOU_LAYER.normalize('date_md', dt) + '</td></tr>'
		      + '<tr><td>状態</td><td>' + (dt.no_junkai ? '巡回中' : '未実施') + '</td></tr>'
		      + '<tr><td>巡回コース</td><td>' + JISYOU_LAYER.normalize('route', dt) + '</td></tr>'
		      + '<tr><td>巡回種別</td><td>' + JISYOU_LAYER.normalize('syubetu', dt) + '</td></tr>'
		      + '<tr><td>担当者名１</td><td>' + JISYOU_LAYER.normalize('tantou1', dt) + '</td></tr>'
		      + '<tr><td>担当者名２</td><td>' + JISYOU_LAYER.normalize('tantou2', dt) + '</td></tr>'
		      + '<tr><td>運転員</td><td>' + JISYOU_LAYER.normalize('unten', dt) + '</td></tr>'
		      + '</table>'
		;
		
		var card = '<button class="card button plan single" data-action="detail" data-no_plan="'+dt.no+'" data-no_junkai="'+dt.no_junkai+'">' + h + '</button>';
		area.push(card);
	}
	area = area.join('');
	
	var route_select = JISYOU_LAYER.makeSelect(data.route);
	var tantou1_select = JISYOU_LAYER.makeSelect(data.tantou);
	data.tantou.unshift({value: -1, text: ''});
	var tantou2_select = JISYOU_LAYER.makeSelect(data.tantou);
	var unten_select = JISYOU_LAYER.makeSelect(data.unten);
	
	var area2 = '<div class="card"><table class="junkai_plan_list">'
	          + '<tr><td>巡回コース</td><td><select name="route">' + route_select + '</select></td></tr>'
	          + '<tr><td>巡回種別</td><td>通常巡回</td></tr>'
	          + '<tr><td>担当者名１</td><td><select name="tantou1">' + tantou1_select + '</select></td></tr>'
	          + '<tr><td>担当者名２</td><td><select name="tantou2">' + tantou2_select + '</select></td></tr>'
	          + '<tr><td>運転員</td><td><select name="unten">' + unten_select + '</select></td></tr>'
	          + '<tr><td>重点観察事項</td><td><input type="text" name="juuten" maxLength="120"></td></tr>'
	          + '<tr><td>天候</td><td><input type="text" name="tenkou" maxLength="60"></td></tr>'
	          + '<tr><td>摘要</td><td><input type="text" name="tekiyou" maxLength="240"></td></tr>'
	          + '<tr><td colspan="2"><button type="button" class="button new_junkai">選択</button></td></tr>'
	          + '</table></div>'
	;
	
	var html = '<div class="JISYOU_LAYER_contents">'
	         + ' 巡回計画選択'
	         + ' <div class="list_area">'+area+'</div>'
	         + ' 新規'
	         + ' <div class="list_area">'+area2+'</div>'
	         + '</div>'
	;
	
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
};


/**
 * 担当取得
 */
JISYOU_LAYER.junkai.getDataSaigai = function () {
	
	JISYOU_LAYER.ajax_store.junkai_saigailist = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJunkaiSaigaiList_lax.php',
		type: 'get',
		cache: false,
		dataType: 'json',
	}).done(JISYOU_LAYER.junkai.showDataSaigai).fail(JISYOU_LAYER.junkai.errorData);
};

/**
 * 災害巡回担当者
 */
JISYOU_LAYER.junkai.showDataSaigai = function (data) {
	var area = [];
	for (var i = 0, ilen = data.data.length; i < ilen; ++i) {
		var dt = data.data[i];
		var h = '<table class="junkai_plan_list '+(dt.no_junkai ? 'tracking' : '')+'">'
		      + '<tr><td>巡回日</td><td>' + JISYOU_LAYER.normalize('date_md', dt) + '</td></tr>'
		      + '<tr><td>状態</td><td>' + (dt.no_junkai ? '巡回中' : '未実施') + '</td></tr>'
		      + '<tr><td>巡回コース</td><td>' + JISYOU_LAYER.normalize('route', dt) + '</td></tr>'
		      + '<tr><td>巡回種別</td><td>' + JISYOU_LAYER.normalize('syubetu', dt) + '</td></tr>'
		      + '<tr><td>担当者名１</td><td>' + JISYOU_LAYER.normalize('tantou1', dt) + '</td></tr>'
		      + '<tr><td>担当者名２</td><td>' + JISYOU_LAYER.normalize('tantou2', dt) + '</td></tr>'
		      + '<tr><td>運転員</td><td>' + JISYOU_LAYER.normalize('unten', dt) + '</td></tr>'
		      + '</table>'
		;
		
		var card = '<button class="card button saigai single" data-action="detail" data-no_junkai="'+dt.no_junkai+'">' + h + '</button>';
		area.push(card);
	}
	area = area.join('');
	
	var tantou1_select = JISYOU_LAYER.makeSelect(data.tantou);
	data.tantou.unshift({value: -1, text: ''});
	var tantou2_select = JISYOU_LAYER.makeSelect(data.tantou);
	var unten_select = JISYOU_LAYER.makeSelect(data.unten);
	
	var area2 = '<div class="card"><table class="junkai_plan_list">'
	          + '<tr><td>巡回種別</td><td>災害巡回</td></tr>'
	          + '<tr><td>担当者名１</td><td><select name="tantou1">' + tantou1_select + '</select></td></tr>'
	          + '<tr><td>担当者名２</td><td><select name="tantou2">' + tantou2_select + '</select></td></tr>'
	          + '<tr><td>運転員</td><td><select name="unten">' + unten_select + '</select></td></tr>'
	          + '<tr><td>重点観察事項</td><td><input type="text" name="juuten" maxLength="120"></td></tr>'
	          + '<tr><td>天候</td><td><input type="text" name="tenkou" maxLength="60"></td></tr>'
	          + '<tr><td>摘要</td><td><input type="text" name="tekiyou" maxLength="240"></td></tr>'
	          + '<tr><td colspan="2"><button type="button" class="button new_saigai">巡回開始</button></td></tr>'
	          + '</table></div>'
	;
	
	var html = '<div class="JISYOU_LAYER_contents">'
	         + ' 巡回選択'
	         + ' <div class="list_area">'+area+'</div>'
	         + ' 新規'
	         + ' <div class="list_area">'+area2+'</div>'
	         + '</div>'
	;
	
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
};

/**
 * 巡回日誌リストを取得
 */
JISYOU_LAYER.junkai.getDataNissi = function (page, stm, etm) {
	page = page || 0;
	if (!stm) {
// 		var sdate = new Date();
// 		sdate.setDate(1);
// 		var edate = new Date();
// 		edate.setDate(1);
// 		edate.setMonth(edate.getMonth() + 1);
// 		edate.setDate(edate.getDate() - 1);
		var edate = new Date();
		var sdate = new Date();
		sdate.setDate(sdate.getDate() - 31);
		stm = JISYOU_LAYER.date2str(sdate, 11);
		etm = JISYOU_LAYER.date2str(edate, 11);
	}
	JISYOU_LAYER.ajax_store.junkai_nissilist = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJunkaiNissiList_lax.php',
		type: 'get',
		data: {page: page, stm: stm, etm: etm},
		cache: false,
		dataType: 'json',
	}).done(function(data){
		JISYOU_LAYER.junkai.showDataNissi(data, stm, etm);
	}).fail(JISYOU_LAYER.junkai.errorData);
};

/**
 * 巡回日誌リストを表示
 */
JISYOU_LAYER.junkai.showDataNissi = function (data, stm, etm) {
	var area = [];
	for (var i = 0, ilen = data.data.length; i < ilen; ++i) {
		var dt = data.data[i];
		var card  = '<button class="card button nissi single" data-no="'+dt.no+'"><table class="junkai_plan_list">'
		          + '<tr><td>日付</td><td>'+dt.date+'</td></tr>'
		          + '<tr><td>巡回コース</td><td>'+dt.route+'</td></tr>'
		          + '<tr><td>巡回種別</td><td>'+dt.syubetu+'</td></tr>'
		          + '<tr><td>担当者名１</td><td>'+dt.tantou1+'</td></tr>'
		          + '<tr><td>担当者名２</td><td>'+dt.tantou2+'</td></tr>'
		          + '<tr><td>運転員</td><td>'+dt.unten+'</td></tr>'
		          + '</table></button>'
		;
		area.push(card);
	}
	area = area.join('');
	// ページ
	var sp1 = data.page - 2;
	if (sp1 < 1) {sp1 = 1;}
	var ep1 = data.page + 2;
	if (ep1 > data.max) {ep1 = data.max;}
	var sp2 = ep1 - 4;
	if (sp2 < 1) {sp2 = 1;}
	var ep2 = sp1 + 4;
	if (ep2 > data.max) {ep2 = data.max;}
	
	var spage = Math.min(sp1, sp2);
	var epage = Math.max(ep1, ep2);
	
	var h = '';
	h += '<button class="button single first" data-page="1" data-stm="'+stm+'" data-etm="'+etm+'">&lt;&lt;</button>'
	   + '<button class="button single" data-page="'+(data.page-1)+'" data-stm="'+stm+'" data-etm="'+etm+'">&lt;</button>'
	;
	for (var p = spage; p <= epage; ++p) {
		var addcls = '';
		if (p == data.page) {
			addcls = 'here';
		}
		h += '<button class="button single '+addcls+'" data-page="'+p+'" data-stm="'+stm+'" data-etm="'+etm+'">'+p+'</button>'
	}
	h += '<button class="button single" data-page="'+(data.page+1)+'" data-stm="'+stm+'" data-etm="'+etm+'">&gt;</button>'
	   + '<button class="button single last" data-page="'+(data.max)+'" data-stm="'+stm+'" data-etm="'+etm+'">&gt;&gt;</button>'
	;
	
	var html = '<div class="JISYOU_LAYER_contents">'
	         + ' <div>道路巡回日誌の表示</div>'
	         + ' <input type="text" value="" data-stm="'+stm+'" data-etm="'+etm+'" class="nissi_time">'
	         + ' <div class="pagemove nissi">'+h+'</div>'
	         + ' <div class="list_area">'+area+'</div>'
	         + ' <div class="pagemove nissi">'+h+'</div>'
	         + '</div>'
	;
	
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
	
};

/**
 * 巡回日誌取得
 */
JISYOU_LAYER.junkai.getNissi = function () {
	var no = $(this).data('no');
	var url = JISYOU_LAYER.apiPath + 'doro_junkainisshi_pdf.php?junkai='+no;
	if(no == 510){
		url = "https://road.jrc-airmultitalk.net/doro_junkainisshi_pdf2.pdf";

	}
	location.href = url;
	//window.open(url,"_blank");
};

/**
 * 巡回日誌時刻変更
 */
JISYOU_LAYER.junkai.changeNissiTime = function (e, options) {
// 	var val = $(this).val();
// 	if (!val) {
// 		return;
// 	}
// 	var ym = val.split('-');
// 	if (ym.length != 2) {
// 		return;
// 	}
// 	var yy = ym[0];
// 	var mm = ym[1];
// 	
// 	JISYOU_LAYER.junkai.getDataNissi(yy, mm);
	// flatpickr経由のみ許可
	if (options) {
		var $$ = $(this);
		var stm = $$.data('stm');
		var etm = $$.data('etm');
		JISYOU_LAYER.junkai.getDataNissi(0, stm, etm);
	}
};

/**
 * 巡回日誌ページ変更
 */
JISYOU_LAYER.junkai.changeNissiPage = function (e) {
	var $$ = $(this);
	var stm = $$.data('stm');
	var etm = $$.data('etm');
	var page = $$.data('page');
	JISYOU_LAYER.junkai.getDataNissi(page, stm, etm);
};

/**
 * 巡回日誌リストを取得
 */
JISYOU_LAYER.junkai.getDataJunkaiKiroku = function (page, stm, etm) {
	page = page || 0;
	if (!stm) {
// 		var sdate = new Date();
// 		sdate.setDate(1);
// 		var edate = new Date();
// 		edate.setDate(1);
// 		edate.setMonth(edate.getMonth() + 1);
// 		edate.setDate(edate.getDate() - 1);
		var edate = new Date();
		var sdate = new Date();
		sdate.setDate(sdate.getDate() - 31);
		stm = JISYOU_LAYER.date2str(sdate, 11);
		etm = JISYOU_LAYER.date2str(edate, 11);
	}
	JISYOU_LAYER.ajax_store.junkai_kirokulist = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJunkaiNissiList_lax.php',
		type: 'get',
		data: {page: page, stm: stm, etm: etm},
		cache: false,
		dataType: 'json',
	}).done(function(data){
		JISYOU_LAYER.junkai.showDataJunkaiKiroku(data, stm, etm);
	}).fail(JISYOU_LAYER.junkai.errorData);
};

/**
 * 巡回日誌リストを表示
 */
JISYOU_LAYER.junkai.showDataJunkaiKiroku = function (data, stm, etm) {
	var area = [];
	for (var i = 0, ilen = data.data.length; i < ilen; ++i) {
		var dt = data.data[i];
		var card  = '<button class="card button kiroku single" data-no="'+dt.no+'"><table class="junkai_plan_list">'
		          + '<tr><td>日付</td><td>'+dt.date+'</td></tr>'
		          + '<tr><td>巡回コース</td><td>'+dt.route+'</td></tr>'
		          + '<tr><td>巡回種別</td><td>'+dt.syubetu+'</td></tr>'
		          + '<tr><td>担当者名１</td><td>'+dt.tantou1+'</td></tr>'
		          + '<tr><td>担当者名２</td><td>'+dt.tantou2+'</td></tr>'
		          + '<tr><td>運転員</td><td>'+dt.unten+'</td></tr>'
		          + '</table></button>'
		;
		area.push(card);
	}
	area = area.join('');
	// ページ
	var sp1 = data.page - 2;
	if (sp1 < 1) {sp1 = 1;}
	var ep1 = data.page + 2;
	if (ep1 > data.max) {ep1 = data.max;}
	var sp2 = ep1 - 4;
	if (sp2 < 1) {sp2 = 1;}
	var ep2 = sp1 + 4;
	if (ep2 > data.max) {ep2 = data.max;}
	
	var spage = Math.min(sp1, sp2);
	var epage = Math.max(ep1, ep2);
	
	var h = '';
	h += '<button class="button single first" data-page="1" data-stm="'+stm+'" data-etm="'+etm+'">&lt;&lt;</button>'
	   + '<button class="button single" data-page="'+(data.page-1)+'" data-stm="'+stm+'" data-etm="'+etm+'">&lt;</button>'
	;
	for (var p = spage; p <= epage; ++p) {
		var addcls = '';
		if (p == data.page) {
			addcls = 'here';
		}
		h += '<button class="button single '+addcls+'" data-page="'+p+'" data-stm="'+stm+'" data-etm="'+etm+'">'+p+'</button>'
	}
	h += '<button class="button single" data-page="'+(data.page+1)+'" data-stm="'+stm+'" data-etm="'+etm+'">&gt;</button>'
	   + '<button class="button single last" data-page="'+(data.max)+'" data-stm="'+stm+'" data-etm="'+etm+'">&gt;&gt;</button>'
	;
	
	var html = '<div class="JISYOU_LAYER_contents">'
	         + ' <div>道路巡回記録の編集</div>'
	         + ' <input type="text" value="" data-stm="'+stm+'" data-etm="'+etm+'" class="kiroku_time">'
	         + ' <div class="pagemove kiroku">'+h+'</div>'
	         + ' <div class="list_area">'+area+'</div>'
	         + ' <div class="pagemove kiroku">'+h+'</div>'
	         + '</div>'
	;
	
	JISYOU_LAYER.sidebox_show(html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
	
};

/**
 * 巡回記録時刻変更
 */
JISYOU_LAYER.junkai.changeKirokuTime = function (e, options) {
// 	var val = $(this).val();
// 	if (!val) {
// 		return;
// 	}
// 	var ym = val.split('-');
// 	if (ym.length != 2) {
// 		return;
// 	}
// 	var yy = ym[0];
// 	var mm = ym[1];
// 	
// 	JISYOU_LAYER.junkai.getDataJunkaiKiroku(yy, mm);
	// flatpickr経由のみ許可
	if (options) {
		var $$ = $(this);
		var stm = $$.data('stm');
		var etm = $$.data('etm');
		JISYOU_LAYER.junkai.getDataJunkaiKiroku(0, stm, etm);
	}
};

/**
 * 巡回記録ページ変更
 */
JISYOU_LAYER.junkai.changeKirokuPage = function (e) {
	var $$ = $(this);
	var stm = $$.data('stm');
	var etm = $$.data('etm');
	var page = $$.data('page');
	JISYOU_LAYER.junkai.getDataJunkaiKiroku(page, stm, etm);
};

/**
 * 巡回記録取得橋渡し
 */
JISYOU_LAYER.junkai.getKirokuBridge = function () {
	var no = $(this).data('no');
	JISYOU_LAYER.junkai.getKiroku(no);
};

/**
 * 巡回記録取得
 */
JISYOU_LAYER.junkai.getKiroku = function (no) {
	JISYOU_LAYER.ajax_store.kiroku_edit = $.ajax({
		url: JISYOU_LAYER.apiPath + 'getJunkaiEdit_lax.php',
		type: 'get',
		data: {no_junkai: no},
		cache: false,
		dataType: 'json',
	}).done(function(data){
		JISYOU_LAYER.sidebox_show(data.html, JISYOU_LAYER.junkai.unsetEvent, JISYOU_LAYER.junkai.setEvent);
	}).fail(JISYOU_LAYER.junkai.errorData);
};

/**
 * 巡回記録修正
 */
JISYOU_LAYER.junkai.editKiroku = function () {
	if (!confirm('巡回データを変更します。よろしいですか？')) {
		return;
	}
	var data = {};
	
	var $wrap = $(this).closest('.junkai_detail_edit').find('table.keiyuti');
	
	// 巡回番号
	var no = $(this).data('no_junkai');
	data.no_junkai = no;
	
	// 日付
	var ymd = $wrap.find('[name="date"]').val();
	var stm = $wrap.find('[name="st_time"]').val();
	var etm = $wrap.find('[name="et_time"]').val();
	var sdate = new Date(ymd + ' ' + stm);
	var edate = new Date(ymd + ' ' + etm);
	if (isNaN(sdate.getTime()) || isNaN(edate.getTime())) {
		alert('日付が間違っています。');
		return;
	}
	data.sdt = JISYOU_LAYER.date2str(sdate, 0);
	data.edt = JISYOU_LAYER.date2str(edate, 0);
	
	// 天候
	data.tenkou = $wrap.find('[name="tenkou"]').val();
	
	// 担当名
	data.tantou1 = $wrap.find('[name="tantou1"]').val();
	data.tantou2 = $wrap.find('[name="tantou2"]').val();
	
	// 運転員
	data.unten = $wrap.find('[name="unten"]').val();
	
	// 経由時刻
	data.keiyuti = [];
	$wrap.find('.keiyuti_box').find('input').each(function(){
		var $inp = $(this);
		var ix = $inp.attr('name').split('_').pop();
		ix = ix - 1;
		data.keiyuti[ix] = $inp.val();
	});
	
	// 重点項目
	data.juuten = $wrap.find('[name="juuten"]').val();
	
	// 摘要
	data.tekiyou = $wrap.find('[name="tekiyou"]').val();
	
	JISYOU_LAYER.ajax_store.edit_junkai_detail = $.ajax({
		url: JISYOU_LAYER.apiPath + 'updateJunkaiDetail_lax.php',
		type: 'post',
		data: data,
	}).done(function(){
		alert('変更しました。');
		JISYOU_LAYER.junkai.getKiroku(no);
	}).fail(function(){
		alert('登録に失敗しました。');
	});
};

/**
 * 巡回事象修正
 */
JISYOU_LAYER.junkai.editJisyou = function () {
	var no_jisyou = $(this).data('no_jisyou');
	var no_junkai = $(this).data('no_junkai');
	JISYOU_LAYER.edit.no = no_jisyou;
	JISYOU_LAYER.edit.init(function(){
		JISYOU_LAYER.junkai.getKiroku(no_junkai);
	});
};

/**
 * 新規事象作成
 */
JISYOU_LAYER.junkai.newJisyou = function () {
	var no_junkai = $(this).data('no_junkai');
	JISYOU_LAYER.junkai.no_junkai = no_junkai;
	JISYOU_LAYER.edit.init(function(){
		JISYOU_LAYER.junkai.getKiroku(no_junkai);
	});
};

/**
 * 日付範囲input作成関数
 * @param string selector 対象inputへのセレクタ
 * @return flatpickr instance
 */
JISYOU_LAYER.junkai.setRangeInput = function (selector) {
	var $inp = $(selector);
	if ($inp.length == 0) {
		return null;
	}
	var now = new Date();
	var flatpickr_instance = $inp.flatpickr({
		mode:'range', 
		dateFormat: 'Y/m/d', 
		maxDate: JISYOU_LAYER.date2str(now, 11),
		locale: {
			weekdays: {
				shorthand: ["日", "月", "火", "水", "木", "金", "土"],
				longhand: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]
			},
			months: {
				shorthand: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
				longhand: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
			},
			rangeSeparator: ' ～ '
		},
		defaultDate: [$inp.data('stm'), $inp.data('etm')],
		onChange: function(dates, value, instance){
			if (dates.length != 2) {return;}
			var $inp = $(instance.input);
			$inp.data('stm', JISYOU_LAYER.date2str(dates[0], 11));
			$inp.data('etm', JISYOU_LAYER.date2str(dates[1], 11));
			$inp.trigger('change', {flatpickr: true});
		}
	});
	return flatpickr_instance;
};

