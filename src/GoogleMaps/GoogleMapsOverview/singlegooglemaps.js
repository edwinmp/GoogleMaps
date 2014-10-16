dojo.provide("GoogleMaps.GoogleMapsOverview.singlegooglemaps");

(function() {
	'use strict';

	dojo.declare("GoogleMaps.GoogleMapsOverview.singlegooglemaps", mxui.widget._WidgetBase, {

		_hasStarted : false,
		googleMap : null,
		currMarker : null,
		_sub : null,

		startup : function () {
			if (this._hasStarted)
				return;

			this._hasStarted = true;

			dojo.addClass(this.domNode, 'singlegooglemaps');
			dojo.addClass(this.domNode, 'singlegooglemaps');

			if (!window._googleLoading) {
				window._googleLoading = true;
				var googleAPILoad = mxui.dom.script({"src" : 'https://www.google.com/jsapi', "id" : 'GoogleLoadScript'});
				document.getElementsByTagName("head")[0].appendChild(googleAPILoad);
			}
			if (window._googleMapsCounter != null && window._googleMapsCounter > 0)
				++window._googleMapsCounter;
			else
				window._googleMapsCounter = 1;

			this.actLoaded();
		},

		update : function(obj, callback) {
			if (!obj) {
				callback && callback();
				return;
			}

			if (this._sub)
				this.unsubscribe(this._sub);

			this.subscribe({
				guid : obj.getGuid(),
				callback : this.newObjectUpdate
			});

			this.loadGoogle(dojo.hitch(this, function () {
				this.jumpToLoc(obj.get(this.latAttr), obj.get(this.lngAttr));
			}));

			callback && callback();
		},

		newObjectUpdate : function(guidstr) {
			if (typeof guidstr === 'string') {
	            mx.data.get({
					guids    : [guidstr],
					callback : dojo.hitch(this, function (obj) {
						this.update(obj[0])
					})
				});
	        } else if (guidstr && guidstr.getGuid && guidstr.getGuid()) {
	        	this.update(guidstr);
	        } else {
	        	console.log("SingleGoogleMaps could not find an object.", guidstr);
	        }
		},

		loadGoogle : function(callback){
			// Are the scripts + map loaded?
			if(!window._googleMapLoaded || window._googleMapLoaded === false) {
				window._googleMapLoaded = true;
				mendix.lang.runOrDelay(dojo.hitch(this, function() {	// Run this as soon as the google object is available.
					if(this.apiAccessKey != ''){
						google.load("maps", "3", {'other_params':"key=" + this.apiAccessKey + "&sensor=false", "callback" : dojo.hitch(this, this.displayMap, callback)});
					} else {
						google.load("maps", "3", {'other_params':"&sensor=false", "callback" : dojo.hitch(this, this.displayMap, callback)}); 		
					}
				}),
				function () { 
					return typeof google != "undefined"; 
				});
			} else {
				mendix.lang.runOrDelay(dojo.hitch(this, function() {
					this.displayMap(callback);
				}),
				function () {
					return typeof google != "undefined" && typeof google.maps != "undefined" && typeof google.maps.Map != "undefined"; 
				});
			}
		},

		displayMap : function (callback) {
			// Run this as soon as google maps is loaded.
			// Create map and its container.
			if (!this.googleMap || this.googleMap == '') {
				
				var newmap = mxui.dom.div({'style' : 'height: '+this.mapHeight+'px; width: '+this.mapWidth+';'});
				
				this.googleMap = new google.maps.Map(newmap, {
					zoom : 11,
					center : new google.maps.LatLng(this.defaultLat, this.defaultLng),
					mapTypeId: google.maps.MapTypeId.ROADMAP,
					mapTypeControlOption : {
						style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR   
					}
				});
				
				//loading finished.
				
				this.domNode.appendChild(newmap);
				google.maps.event.trigger(this.googleMap, 'resize');
				this.googleMapsLoaded = true;
				
				callback && callback();
			} else {
				callback && callback();
			}
		},

		setMarker : function (lat, lng) {
			if (this.currMarker) {
				this.currMarker.setMap(null);
			}

			var markerIcon = '';
			if (this.defaultIcon != '') {
				markerIcon = this.defaultIcon;
			}
			
			if ((lat >= -90 && lat <= 90)&&(lng >= -180 && lng <= 180)) {
				var point = new google.maps.LatLng(lat, lng);
				
				var marker = new google.maps.Marker({
					'position' : point,
					'map' : this.googleMap,
					'icon' : (markerIcon !== '') ? markerIcon : ''
				});
				
				this.currMarker = marker;
			}
		},

		jumpToLoc : function (lat, lng) {
			this.setMarker(lat, lng);
			google.maps.event.trigger(this.googleMap, 'resize');
			var Loc = new google.maps.LatLng(lat, lng);
			this.googleMap.setZoom(this.lowestZoom);
			this.googleMap.setCenter(Loc);
		},

		uninitialize : function(){
			if (window._googleMapsCounter == null || --window._googleMapsCounter <= 0) {
				var googleScript = dojo.query('head #GoogleLoadScript')[0];
				googleScript && dojo.destroy(dojo.query('head #GoogleLoadScript')[0]); // XXX: dojo.destroy(googleScript)  ??
				window._googleLoading == null;
			}
		}
	});
})();