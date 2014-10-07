/**
	Google Maps Overview Widget
	========================

	@file      : googlemapsoverview.js
	@version   : 1.2.2
	@author    : Robert van 't Hof
	@date      : 17-11-2010
	@copyright : Mendix

	Documentation
	=============
	This widget lets you plot a list of addressess on a Google Map and marks them with markers.

*/
dojo.provide("GoogleMaps.GoogleMapsOverview.googlemapsoverview");

mxui.widget.declare("GoogleMaps.GoogleMapsOverview.googlemapsoverview", {
	addons     : [dijit._Contained, mxui.addon._Contextable],
  
	inputargs  : {
		apiAccessKey		: '',
		mapEntity			: '',
		xpathConstraint		: '',
		markerDisplayAttr	: '',
		mapHeight			: 0,
		mapWidth			: '',
		defaultLat  		: '',
		defaultLng  		: '',
		lowestZoom          : 15,
		gotocontext			: false,
		latAttr				: '',
		lngAttr				: '',
		updateRefresh       : false,
		enumAttr            : '',
		defaultIcon			: '',
		enumKey             : '',
		enumImage           : ''
	},
	
	//Caches
	googleMap			: '',
	locationBox			: '',
	latlngCache			: '',
	googleMapsLoaded	: false,
	mapBounds			: null,
	totalLat			: null,
	totalLng			: null,
	markers				: null,
	markerIsSet			: false,
	schema              : null,
	entitySubscribes    : null,
	markerImages        : null,
	latSplit			: '',
	lngSplit			: '',
	splits				: null,
	refs 				: null,
	
	fixObjProps : function(props) {
	    var args = {};
	    
	    for (var i = 0, prop; prop = props[i]; i++) {
	        var arr = this[prop];

	        for (var j = 0, obj; obj = arr[j]; j++) {
	            for (var p in obj) {
	                (args[p] || (args[p] = [])).push(obj[p]);
	            }
	        }
	    }
	    
	    for (var a in args) {
	        this[a] = args[a].join(";");
	    }
	},

	postCreate : function() {
		if (dojo.version.major == 5) {
				this.fixObjProps(['unused']);
		} 
		this.totalLat = [];
		this.totalLng = [];
		this.schema = [];
		this.entitySubscribes  = [];
		this.markerImages = [];
		this.splits = {};
		this.refs = {};
		this.markers = {};

		dojo.addClass(this.domNode, 'googleMapsWidget');
		
		if (!window._googleLoading) {
			window._googleLoading = true;
			var googleAPILoad = mxui.dom.script({"src" : 'https://www.google.com/jsapi', "id" : 'GoogleLoadScript'});
			document.getElementsByTagName("head")[0].appendChild(googleAPILoad);
		}
		if (window._googleMapsCounter != null && window._googleMapsCounter > 0)
			++window._googleMapsCounter;
		else
			window._googleMapsCounter = 1;
		
		if (this.enumAttr !== '' && this.enumKey != '' && this.enumImage != '') {
			var keys = this.enumKey.split(";");
			var images = this.enumImage.split(";");
			for (var i = 0; i < keys.length; i++) {
				var newImage = {
					key : keys[i],
					image : images[i]
				};
				this.markerImages.push(newImage);
			}
		}
		this.initContext();
		this.actRendered();
	},
	applyContext : function(context, callback){
		this.loadGoogle(dojo.hitch(this, function() {
			var hascontext = context && context.hasActiveGUID && context.hasActiveGUID();
			if (this.gotocontext) {
				//haal objecten op, zonder current object replace
				if (hascontext)
					if (this.markers.length > 0)
						this.gotoMarker(context.getActiveGUID());
					else
						this.getListObjects(0, dojo.hitch(this, this.gotoMarker, context.getActiveGUID()));
				else
					this.getListObjects();
			}
			else if (this.xpathConstraint.indexOf('[%CurrentObject%]') > -1) {
				if (hascontext) //geen gotocontext, context constraint de set van objcten
					this.getListObjects(context.getActiveGUID());
				else if (this.googleMap) {
					this.gotoDefaultLoc();
				}
			}
			else //xpath contains no current object, context uberhaupt niet interessant
				this.getListObjects();
		}));
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
			
			callback && callback(); // getListObjects()
		} else {
			callback();
		}
	},	
	getListObjects : function(contextguid, callback) {
		var xpathString = '';
		if (contextguid > 0)
			xpathString = "//" + this.mapEntity + this.xpathConstraint.replace(/\[\%CurrentObject\%\]/gi, contextguid);
		else
			xpathString = "//" + this.mapEntity + this.xpathConstraint;
			
		this.schema = [];
		this.refs = {};
		
		this.loadSchema(this.latAttr, 'lat');
		this.loadSchema(this.lngAttr, 'lng');
		this.loadSchema(this.markerDisplayAttr, 'marker');
		this.loadSchema(this.enumAttr, 'imgEnum');
		
		// Met leeg schema geeft ie hele object door, dit is een temporary fix
		if (this.schema.length == 0)
			this.schema.push('createdDate');
		mx.processor.get({
			xpath       : xpathString,
			filter      : {
				attributes  : this.schema,
				references	: this.refs
			},
			callback    : dojo.hitch(this, this.processObjectsList, callback),
			error       : dojo.hitch(this, function(err) {
				console.error("GoogleMapsOverview: Unable to retrieve data: " + err);
			})
		});
	},
	loadSchema : function (attr, name) {
		if (attr != '') {
			this.splits[name] = attr.split("/");
			if (this.splits[name].length > 1)
				if (this.refs[this.splits[name][0]] && this.refs[this.splits[name][0]].attributes)
					this.refs[this.splits[name][0]].attributes.push(this.splits[name][2]);
				else
					this.refs[this.splits[name][0]] = {attributes : [this.splits[name][2]]};
			else
				this.schema.push(attr);
		}
	},
	processObjectsList : function (callback, objectsArr) {
		var objects = this.parseObjects(objectsArr);
		if (this.infowindow)
			this.infowindow.close();
		
		if (this.updateRefresh && this.entitySubscribes.length == 0) {
			this.entitySubscribes.push(this.subscribe({
				entity : this.mapEntity,
				callback : dojo.hitch(this, this.objectUpdateNotification)
			}));
			//mx.processor.subscribeToClass(this, this.mapEntity);
			if (this.splits != {})
				for (var split in this.splits) {
					var subref = this.splits[split][0];
					this.entitySubscribes.push(this.subscribe({
						entity : subref,
						callback : dojo.hitch(this, this.objectUpdateNotification)
					}));
					//mx.processor.subscribeToClass(this, subref);
					//this.entitySubscribes.push(subref);
				}
		}
		
		this.mapBounds = new google.maps.LatLngBounds();
		this.markerIsSet = true;
		if (objects.length === 0) {
			this.gotoDefaultLoc();
		}
		
		this.clearOverlays(); // Removes the old markers.
		
		if (objects.length > 0) {
			// Set the markers.
			for (var i = 0; i < objects.length; i++) {
				this.setMarker(objects[i]);
			}

			if (callback && typeof(callback) == "function")
				callback();
			else if (objects.length == 1)
				this.gotoMarker(objects[0].guid);
			else
				this.setCenterAndZoomLevel();
		}
	},
	gotoDefaultLoc : function () {
		google.maps.event.trigger(this.googleMap, 'resize');
		var defaultLoc = new google.maps.LatLng(this.defaultLat, this.defaultLng);
		this.googleMap.setZoom(this.lowestZoom);
		this.googleMap.setCenter(defaultLoc);
	},
	parseObjects : function (objs) {
		var newObjs = [];
		for (var i = 0; i < objs.length; i++) {
			var newObj = {};
			
			newObj['marker'] = this.checkRef(objs[i], 'marker', this.markerDisplayAttr);
			newObj['lat'] = this.checkRef(objs[i], 'lat', this.latAttr);
			newObj['lng'] = this.checkRef(objs[i], 'lng', this.lngAttr);
			newObj['imgEnum'] = this.checkRef(objs[i], 'imgEnum', this.enumAttr);
			newObj['guid'] = objs[i].getGUID();
			
			newObjs.push(newObj);
		}
		return newObjs;
	},
	checkRef : function (obj, attr, nonRefAttr) {
		if (this.splits && this.splits[attr] && this.splits[attr].length > 1) {
			var subObj = obj.getChildren(this.splits[attr][0]);
			return (subObj.length > 0)?subObj[0].getAttribute(this.splits[attr][2]):'';
		} else
			return obj.getAttribute(nonRefAttr);
	},
	setCenterAndZoomLevel : function () {
		google.maps.event.trigger(this.googleMap, 'resize');
		this.googleMap.fitBounds(this.mapBounds);
		if (this.googleMap.getZoom() > this.lowestZoom)
			this.googleMap.setZoom(this.lowestZoom);
	},
	setMarker : function (object) {
		var markerIcon = '';
		if (object.imgEnum != null) {
			for (var i = 0; i < this.markerImages.length; i++)
				if (this.markerImages[i].key == object.imgEnum) {
					markerIcon = this.markerImages[i].image;
					break;
				}
		} else if (this.defaultIcon != '') {
			markerIcon = this.defaultIcon;
		}
		
		if ((object.lat >= -90 && object.lat <= 90)&&(object.lng >= -180 && object.lng <= 180)) {
			var point = new google.maps.LatLng(object.lat, object.lng);
			
			var marker = new google.maps.Marker({
				'position' : point,
				'map' : this.googleMap,
				'icon' : (markerIcon !== '')?markerIcon:''
			});
			this.markers[object.guid] = marker;
			
			this.mapBounds.extend(point);
			if (object.marker != '') {
				google.maps.event.addListener(marker, "click", dojo.hitch(this, function() {
					if (this.infowindow)
						this.infowindow.close();
						
					var infowindow = new google.maps.InfoWindow({
						content: object.marker
					});
					infowindow.open(this.googleMap, marker);
					this.infowindow = infowindow;
				}));
			}
		}
	},
	gotoMarker : function(id) {
		google.maps.event.trigger(this.googleMap, 'resize');
		if (this.markers[id]) {
			this.googleMap.setZoom(this.lowestZoom);
			this.googleMap.setCenter(this.markers[id].getPosition());
		}
	},
	clearOverlays : function() {
		if (this.markers != {}) {
			for (var i in this.markers) {
				this.markers[i].setMap(null);
			}
		}
	},
	objectUpdateNotification : function (object) {
		this.applyContext('', null);
	},
	uninitialize : function(){
		for (var ref in this.entitySubscribes)
			this.unsubscribe(ref);
			//mx.processor.unSubscribeFromClass(this, ref);
			
		this.clearOverlays();
		
		if (window._googleMapsCounter == null || --window._googleMapsCounter <= 0) {
			var googleScript = dojo.query('head #GoogleLoadScript')[0];
			googleScript && dojo.destroy(dojo.query('head #GoogleLoadScript')[0]); // XXX: dojo.destroy(googleScript)  ??
			window._googleLoading == null;
		}
	}
});