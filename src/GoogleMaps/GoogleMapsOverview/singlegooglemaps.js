dojo.provide("GoogleMaps.GoogleMapsOverview.singlegooglemaps");

dojo.declare("GoogleMaps.GoogleMapsOverview.singlegooglemaps", mxui.widget._WidgetBase, {

	_hasStarted : false,
	googleMap : null,

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
		this.loadGoogle(dojo.hitch(){
			this.jumpToLoc(obj.get(this.latAttr), obj.get(this.lngAttr));
		});

		callback && callback();
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

	jumpToLoc : function (lat, lng) {
		google.maps.event.trigger(this.googleMap, 'resize');
		var Loc = new google.maps.LatLng(lat, lng);
		this.googleMap.setZoom(this.lowestZoom);
		this.googleMap.setCenter(Loc);
	}

});