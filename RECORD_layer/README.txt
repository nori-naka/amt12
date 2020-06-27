追加機能インタフェース仕様

概要
追加機能は、GISライブラリOpenLayersのレイヤとして、地図上の表示を行う。
地図上に表示する情報に関しては、特に規定はしないが、非同期通信にて情報提供元サーバから取得する等の形を想定している。

準備
###追加機能の読み込み
追加機能は自らの関連ファイルを収録したフォルダを用意する。
追加機能の収録フォルダ名称：　XXXX‗layer
追加機能のメインファイル名：　XXXX_layer.js

index.htmlでは、「<script src="/XXX_layer/XXX_layer.js"></script>」をmap.jsの後に読み込む。
その後、XXX_layer.add()を実行する。

名前空間
名前の衝突を防ぐため、追加機能側としては、必ず以下の様にして、
各種変数はXXX_layerのオブジェクト内に収容する。

var XXX_layer = XXX_layer || {};

実装すべきメゾット
function XXX_layer.add()
index.htmlにて呼び出す。必要な処理としては、以下とする。
・追加機能の初期化として必要な処理
・表示すべきレイヤの生成
・mapオブジェクトへのaddLayer("生成したレイヤ")の実施
・追加機能のメニューへの登録（★）

function XXX_layer.setOpacity(v)
addLayerしたレイヤの透明度v（0～1）を指定する。

function XXX_layer.remove();
addLayerしたレイヤの削除を行う。

提供される情報
下記の変数がグローバル変数として定義される。
usersはサーバから定期的に送信される子局一覧に相当する。myUidは自分のid値となる。

users = {
    XXXXX : {           //id値
        cam: (boolean)  //カメラの有無を示す。カメラがあってもfalseを帰す事があり、現在は無効とした。
        lat: (緯度数値)  //10進数の緯度
        lng: (経度数値)  //10進数の経度
        name: (文字列)   //表示したい名称
        ttl: (数値　0～5)//Time to Live　初期値6として、送信都度ー1される。対象id値の子局からの応答があれば、初期値に戻る。
    },
    16b300113e76 : {
        cam: (boolean)
        lat: 35.734695
        lng: 139.4869379
        name: "16b300113e76"
        ttl: 5
    }
}

myUid = XXXXXX //自分のid値



追加機能側から使用可能なもの
・sidebox
左横に表示されるdiv要素で、その内容物をHTML要素、またはHTML文字列として渡して表示する。
・centorbox
中央に表示されるdiv要素で、その内容物をHTML要素、またはHTML文字列として渡して表示する。

sidebox_show(value, callback)
centorbox_show(value, callback)

・valueは表示したいHTML要素、またはHTML文字列
・callbackはsidebox、またはcentorboxが閉じられる際に実行されるコールバック関数
　必要なければ、nullで良い。

※　ちなみに、centorは「センター」の意味で書いていたのですが、正しくはcenterでした。

-メニューの定義
--機能メニュー（サブメニューへの切替）
---レイヤメニュー（レイヤ切替）
---フリーハンドメニュー
---ナウキャストメニュー（ナウキャストの時間変更）
---
--通話（ネイティブとの切替）
--ビデオ（映像エリアの表示/非表示の切替）
--位置確定（自位置を中心位置に移動）



ユーザ操作イベント
ユーザ操作イベントとしては、以下を想定する。
・Featureインスタンスへのclick(またはtouch)イベント
・mapへのclick(またはtouch)イベント


Featureインスタンスへのclick(またはtouch)イベント
Featureインスタンスに__$do_func__と、__$undo_func__というメゾットを埋め込む
__$do_func__は、そのFeatureにclickイベント時に実行され、
__$undo_func__は、__$do_func__実行の次のclickイベント時に実行される。

feature.__$do_func__ = function(){....} //
feature.__$undo_func__ = function(){....} //

用途としては、Featureへのclickイベントにて、__$do_func__で、何らかの表示を行い、
__$undo_func__で、その表示を終了する事を想定している。


mapへのclick(またはtouch)イベント
mapに対する直接のユーザ操作イベントでは、何を意図した操作かが不明になるため、
基本的には追加機能をメニューにて有効にして、ユーザ操作イベントを行う。


