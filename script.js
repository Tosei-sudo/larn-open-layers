let app = angular.module("myApp", ["ngRoute"]);

app.constant("appConfig", {
    apiUrl: "./data.geojson",
    wmtsURL: "https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${x}/${y}.png",
    // wmtsURL: "https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${x}/${y}.png",
    wkt: "POINT(138.7309 35.3628)",
});

app.component("test", {
    template: "<div>test</div>",
    controller: function () {
        console.log("test");
    },
});

app.service("MapService", [
    "appConfig",
    function (appConfig) {
        this.Map = function (divId) {
            function mapInit(divId) {
                const map = new OpenLayers.Map(divId,
                    {
                        numZoomLevels: 20,
                    });

                // map.addControl(
                //     new OpenLayers.Control.LayerSwitcher({ ascending: false })
                // );
                // map.addControl(new OpenLayers.Control.KeyboardDefaults());
                map.addControls([
                    new OpenLayers.Control.LayerSwitcher(),
                    new OpenLayers.Control.ScaleLine(),
                    new OpenLayers.Control.KeyboardDefaults(),
                ]);

                return map;
            }

            this.map = mapInit(divId);

            this.addLayer = (layer) => {
                this.map.addLayer(layer);
            };

            this.addXYZLayer = (name, url) => {
                const layer = new OpenLayers.Layer.XYZ(
                    name,
                    url,
                    {
                        isBaseLayer: true,
                        wrapDateLine: true,
                        transitionEffect: "resize",
                        sphericalMercator: true,
                    }
                );
                this.addLayer(layer);
            };

            this.addWFSLayer = (name, url, typename) => {
                let saveStrategy = new OpenLayers.Strategy.Save();

                const layer = new OpenLayers.Layer.Vector(name, {
                    strategies: [new OpenLayers.Strategy.BBOX(), saveStrategy],
                    protocol: new OpenLayers.Protocol.WFS({
                        url: url,
                        featureType: typename,
                        featureNS: "http://www.qgis.org/gml",
                        version: "1.1.0",
                        srsName: "EPSG:4326",
                        geometryName: "geometry",
                    }),
                    projection: new OpenLayers.Projection("EPSG:4326"),
                });

                layer.saveStrategy = saveStrategy;
                this.addLayer(layer);
                return layer;
            }

            this.getProjectionObject = () => {
                return this.map.getProjectionObject();
            };

            this.setCenter = (lonlat, zoom) => {
                this.map.setCenter(lonlat, zoom);
            };

            this.getCenter = () => {
                return this.map.getCenter();
            };

            this.zoomToExtent = (bounds) => {
                this.map.zoomToExtent(bounds);
            };

            this.addPopup = (popup) => {
                this.map.addPopup(popup);
            };

            this.removePopup = (popup) => {
                this.map.removePopup(popup);
            };

            this.events = this.map.events;
        };
    },
]);
// use ng-cloak to prevent the AngularJS html template from being displayed until all the AngularJS library has been loaded.

app.controller("myCtrl", function ($http, $scope, appConfig, MapService, notificationService) {
    this.test = "test";
    this.isEdting = false;

    this.getWKTLayer = () => {

        const style = new OpenLayers.Style({
            pointRadius: "${radius}",
            fillColor: "#ffcc66",
            strokeColor: "#cc6633",
            strokeWidth: 2,
            graphicZIndex: 1,
            label: "${count}",
            fontColor: "#333333",
            fontSize: "12px",
            labelYOffset: -15,
        }, {
            context: {
                radius: function (feature) {
                    if (feature.cluster) {
                        return Math.min(feature.attributes.count, 7) + 3;
                    } else {
                        return 4;
                    }
                },
                count: function (feature) {
                    if (feature.cluster) {
                        return feature.cluster[0].attributes.station_name;
                    } else {
                        return "";
                    }
                }
            }
        });

        this.activePopup = null;

        this.popupClose = () => {
            console.log("close");
            this.map.removePopup(this.activePopup);
            this.activePopup.destroy();
            this.activePopup = null;
        };

        window.popupClose = this.popupClose;

        const eventListeners = {
            featureclick: (evt) => {
                const feature = evt.feature;
                if (feature.attributes.count > 1) {
                    const cluster = feature.cluster;
                    const features = cluster.slice();
                    const bounds = new OpenLayers.Bounds();
                    for (let i = 0; i < features.length; i++) {
                        bounds.extend(features[i].geometry.getBounds());
                    }
                    this.map.zoomToExtent(bounds);
                } else {
                    const feature = evt.feature.cluster[0];
                    if (!!this.activePopup) {
                        this.map.removePopup(this.activePopup);
                        this.activePopup.destroy();
                    }
                    console.log("click");
                    this.activePopup = new OpenLayers.Popup("chicken",
                        feature.geometry.getBounds().getCenterLonLat(),
                        new OpenLayers.Size(200, 200),
                        "example popup",
                        true);
                    // popup = feature.createPopup(true);
                    console.log(feature.attributes)
                    const popupHtml = "<div>station_name: " + feature.attributes.station_name + "</div><div><input type='button' value='close' onClick='popupClose()'></div>";
                    this.activePopup.setContentHTML(popupHtml);
                    this.activePopup.setBackgroundColor("yellow");
                    this.activePopup.setOpacity(0.7);

                    feature.popup = this.activePopup;
                    this.map.addPopup(this.activePopup);
                }
                OpenLayers.Event.stop(evt);
            },
        };

        var vector_layer = new OpenLayers.Layer.Vector("WKT", {
            eventListeners: eventListeners,
            // set Clustering 
            strategies: [
                new OpenLayers.Strategy.Fixed(),
                new OpenLayers.Strategy.Cluster()
            ],
            styleMap: new OpenLayers.StyleMap({
                "default": style,
                "select": {
                    fillColor: "#8aeeef",
                    strokeColor: "#32a8a9"
                }
            }),
            protocol: new OpenLayers.Protocol.HTTP({
                url: "./station.geojson",
                format: new OpenLayers.Format.GeoJSON()
            })
        });

        let b = new OpenLayers.Bounds(140.6827124, 37.80125734, 140.8244188, 37.91311848)
        const imgLayer = new OpenLayers.Layer.Image(
            "Image Layer",
            "./img/sar.png",
            b,
            new OpenLayers.Size(b.getWidth(), b.getHeight()),
            { isBaseLayer: false, numZoomLevels: 10 }
        );

        this.map.addLayer(imgLayer);
        this.map.addLayer(vector_layer);

        // console print center point
        this.map.events.register("moveend", this.map, function () {
            console.log(this.getCenter().transform(
                this.getProjectionObject(),
                new OpenLayers.Projection("EPSG:4326")
            ));
        });
    };

    this.initMap = () => {
        // WMSレイヤーの定義
        // マップの定義
        this.map = new MapService.Map("map");
        $("#map").on("contextmenu", function (e) {
            return false;
        });

        this.map.events.register("mouseup", this.map, (e) => {
            // show context menu
            if (!!this.contextMenu) {
                this.map.map.removePopup(this.contextMenu);
                this.contextMenu.destroy();

                this.contextMenu = null;
            }
            if (e.button == 2) {
                var lonlat = this.map.map.getLonLatFromViewPortPx(e.xy);
                let lonlatWGS84 = lonlat.clone().transform(
                    this.map.getProjectionObject(),
                    new OpenLayers.Projection("EPSG:4326")
                );

                this.contextMenu = new OpenLayers.Popup.FramedCloud(
                    "chicken",
                    lonlat,
                    new OpenLayers.Size(200, 200),
                    "<div class='iass-action' id='btnCopyCoordinate'>Copy Coordinate</div>",
                    null,
                    true
                );
                this.map.map.addPopup(this.contextMenu);

                $("#btnCopyCoordinate").on("click", function () {
                    navigator.clipboard.writeText(
                        lonlatWGS84.lat + " " + lonlatWGS84.lon
                    );
                });
            } else {
            }


        });

        this.map.addXYZLayer("cyberjapan", appConfig.wmtsURL);

        var wkt = "POINT(138.7309 35.3628)";
        var wkt_format = new OpenLayers.Format.WKT();
        var feature = wkt_format.read(wkt);
        feature.geometry.transform(
            new OpenLayers.Projection("EPSG:4326"),
            this.map.getProjectionObject()
        );

        var vector_layer = new OpenLayers.Layer.Vector("WKT");
        vector_layer.addFeatures(feature);

        this.map.addLayer(vector_layer);

        this.map.setCenter(
            new OpenLayers.LonLat(138.7309, 35.3628).transform(
                new OpenLayers.Projection("EPSG:4326"),
                this.map.getProjectionObject()
            ),
            7);
    };

    this.changeEdit = () => {
        this.isEdting = !this.isEdting;
        notificationService.pushMessage("Edit mossssssssssssde: " + this.isEdting, {
            onClicked: () => {
                window.open("https://www.google.com");
            }
        });
    };
});

// spa routing
app.config(function ($routeProvider) {
    $routeProvider
        .when("/", {
            templateUrl: "map.html",
            controller: "myCtrl",
        })
        .otherwise({
            redirectTo: "/",
        });
});

const ngNotificationHtml = `
<div class="notification-wrap">
    <div ng-repeat="message in messages"  ng-click="message.remove(false, true)">
        <div class="notification" ng-class="message.type">
            <span>{{message.text}}</span>
        </div>
    </div>
</div>
<style>
    .notification-wrap {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 1000;
    }
    .notification {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        margin: 5px;
        border: 1px solid #333;
        border-radius: 2px;
        cursor: pointer;
    }
    .info {
        background-color: lightblue;
    }
    .info:hover {
        background-color: blue;
    }
    .error {
        background-color: lightcoral;
    }
    .error:hover {
        background-color: red;
    }
    .warning {
        background-color: lightgoldenrodyellow;
    }
    .warning:hover {
        background-color: goldenrod;
    }
    .success {
        background-color: lightgreen;
    }
    .success:hover {
        background-color: green;
        color: white;
    }
    /* animetions */
    .notification {
        animation: slideIn 0.2s forwards;
    }
    @keyframes slideIn {
        0% {
            transform: translateY(-100%);
        }
        100% {
            transform: translateY(0);
        }
    }
</style>
`;

app.directive("ngNotification", function () {
    return {
        restrict: "E",
        template: ngNotificationHtml,
        controller: function ($scope, notificationService) {
            vm = $scope;

            vm.messages = notificationService.getMessages();
            notificationService.updateHook = function (doApply = false) {
                vm.messages = notificationService.getMessages();

                if (doApply) {
                    $scope.$apply();
                }
            };
        }
    };
})
app.service("notificationService", function () {
    this.messages = [];

    this.getMessages = function () {
        return this.messages;
    };
    this.pushMessage = function (message, messageOptions) {
        let defaultOptions = {
            type: "success",
            timeout: 3000,
        };
        messageOptions = Object.assign(defaultOptions, messageOptions);
        messageOptions.text = message;
        messageOptions.remove = (doApply = false, clicked = false) => {
            if ("onClicked" in messageOptions && clicked) {
                messageOptions.onClicked();
            }
            this.messages = this.messages.filter((m) => m !== messageOptions);
            this.updateHook(doApply);
        };

        setTimeout(() => {
            messageOptions.remove(true);
        }, messageOptions.timeout);
        this.messages.push(messageOptions);

        this.updateHook();
    };
    this.updateHook = function () {
        console.log("updateHook");
    };
});