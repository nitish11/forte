/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *	Input techniques - contains a collection of input techniques
 *
 *	@author Xiang 'Anthonj' Chen http://xiangchen.me
 *
 *	NOTE:
 *	> it assumes a global variable camera exists - might want to fix that
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

var XAC = XAC || {};

XAC.IDLE = 0;
XAC.LEFTMOUSE = 1;
XAC.RIGHTMOUSE = 3;
XAC.WHEEL = 4;

//
//	a plane orthogonal to the camera for manipulation
//	@param	pos - the position of a point in R3
//	@param	orthogonal - whether to snap the plane to XZ or Y
//	@param	showPlane - whether to show the plane visually
//
XAC.Maniplane = function(pos, scene, camera, canvas, orthogonal, showPlane) {
	this._camera = camera;
	this._scene = scene;
	this._canvas = canvas;

	this._plane = new XAC.Plane(1000, 1000, showPlane == true ? XAC.MATERIALPLAIN :
		XAC.MATERIALINVISIBLE).m;
	this._plane.material.opacity = 0.5;
	this._plane.position.copy(pos);

	var vecView = new THREE.Vector3().subVectors(this._camera.position, this._plane
		.position);

	// //HACK
	// var vecView = new THREE.Vector3(0, 0, 1);

	if (orthogonal == true) {
		var angleView = new THREE.Vector3(0, 1, 0).angleTo(vecView);
		if (angleView > Math.PI / 3) {
			XAC.rotateObjTo(this._plane, vecView);
		}
	} else {
		XAC.rotateObjTo(this._plane, vecView);
	}

	this._scene.add(this._plane);
};

XAC.Maniplane.prototype = {
	update: function(e) {
		return XAC.hitPoint(e, [this._plane], this._camera, this._canvas);
	},

	setPosition: function(pos) {
		this._plane.position.copy(pos);
	},

	destruct: function() {
		this._scene.remove(this._plane);
		// this._plane.material.opacity = 0.25;
		// this._plane.material.needsUpdate = true;
	}
}

//
//	a sphere based selector for specifying a vector coming from the centroid
//	@param	pos - position to place the selector
//	@param	radius - how big should the sphere be
//	TODO: fix the getty functions
//
XAC.SphereSelector = function(pos, radius, scene, camera) {
	this._pos = pos;
	this._radius = radius;
	this._scene = scene;
	this._camera = camera;

	this._update = function() {
		this._scene.remove(this._sphere);
		this._sphere = new XAC.Sphere(this._radius, XAC.MATERIALINVISIBLE, true).m;
		this._sphere.position.copy(this._pos);
		this._scene.add(this._sphere);
	}
	this._update();
}

XAC.SphereSelector.prototype = {
	hitTest: function(e) {
		var intSphere = XAC.rayCast(e.clientX, e.clientY, [this._sphere], this._camera);
		if (intSphere[0] != undefined) {
			this._pt = intSphere[0].point;
			this._scene.remove(this._line);
			this._line = XAC.addAnArrow(this._scene, this._pos, this._pt.clone().sub(
				this._pos), this._radius * 1.5, 2.5);
		}
	},

	clear: function() {
		this._scene.remove(this._sphere);
		this._scene.remove(this._dot);
		this._scene.remove(this._line);
	},

	setRadius: function(radius) {
		this._radius = radius;
		this._update();
	},

	selection: function() {
		return this._pt;
	},

	pointer: function() {
		return this._line;
	}
}

//
//	marquee select for 2d and 3d
//
XAC.MarqueeSelector = function(canvas, camera) {
	this._canvas = canvas;
	this._camera = camera;

	$("#selection").on('mouseup', function(e) {
		this._selection = false;
		$("#selection").hide();
		this._onSelected();
	}.bind(this));

	// enable dragging into the selection frame
	$('#selection').on('mousemove', function(e) {
		this.mousemove(e);
	}.bind(this));
}

XAC.MarqueeSelector.prototype = {
	mousedown: function(e, onSelected) {
		this._selection = true;
		this._x1 = e.pageX;
		this._y1 = e.pageY;
		this._onSelected = onSelected;
	},

	mousemove: function(e) {
		if (this._selection) {
			var x2 = e.pageX;
			var y2 = e.pageY;

			this._top = Math.min(this._y1, y2);
			this._left = Math.min(this._x1, x2);
			this._height = Math.max(this._y1, y2) - this._top;
			this._width = Math.max(this._x1, x2) - this._left;

			$("#selection").css({
				position: 'absolute',
				zIndex: 5000,
				left: this._left,
				top: this._top,
				width: this._width,
				height: this._height
			});

			$("#selection").show();
		}
	},

	// mouseup: function(e) {
	// 	this._selection = false;
	// 	$("#selection").hide();
	// },

	// get the rect for 2D selection
	getRect: function() {
		return {
			top: this._top,
			left: this._left,
			width: this._width,
			height: this._height
		};
	},

	// get the intersecting box for 3D selection
	getIntersectingBox: function() {
		// retrieve the 2d rect
		var rect = this.getRect();

		// find the looking-from point
		var rectCanvas = this._canvas.getBoundingClientRect();
		var scrn2world = function(x, y, rectCanvas, camera) {
			var pTransformed = new THREE.Vector3(
				x / (rectCanvas.right - rectCanvas.left) * 2 - 1, -y / (rectCanvas.bottom -
					rectCanvas.top) * 2 + 1, 0.5);
			pTransformed.unproject(camera)
			return pTransformed;
		}
		var x = rect.left + rect.width / 2;
		var y = rect.top + rect.height / 2;
		var center = scrn2world(x, y, rectCanvas, this._camera);

		// ground
		var ground = new THREE.Mesh(
			new THREE.CubeGeometry(1000, 1000, 1),
			XAC.MATERIALINVISIBLE
		);
		// HACK
		FORTE.canvasScene.add(ground);

		ground.position.z -= 0.5;

		// create a virtual box for intersection
		var topLeft = XAC.hitPoint({
			clientX: rect.left,
			clientY: rect.top
		}, [ground], this._camera, this._canvas);
		// addABall(FORTE.canvasScene, topLeft, 0xff0000, 5, 1);
		var topRight = XAC.hitPoint({
			clientX: rect.left + rect.width,
			clientY: rect.top
		}, [ground], this._camera, this._canvas);
		// addABall(FORTE.canvasScene, topRight, 0xff0000, 5, 1);
		var bottomLeft = XAC.hitPoint({
			clientX: rect.left,
			clientY: rect.top + rect.height
		}, [ground], this._camera, this._canvas);
		// addABall(FORTE.canvasScene, bottomLeft, 0xff0000, 5, 1);

		var w = topLeft.distanceTo(topRight);
		var l = topLeft.distanceTo(bottomLeft);
		var t = 20;		// HACK: deal with almost 2d cases only
		var box = new XAC.Box(w, t, l, XAC.MATERIALNORMAL).m;
		// XAC.rotateObjTo(box, center.clone().sub(this._camera.position));
		XAC.rotateObjTo(box, this._camera.position.clone().sub(ground.position));
		box.position.copy(topRight.clone().add(bottomLeft).multiplyScalar(0.5));

		// HACK
		FORTE.canvasScene.remove(ground);

		return box;
	}
}

//
//	a slider shown and used in situ with an object
//
XAC.InSituSlider = function(canvas) {
	this._canvas = canvas;
	this._slider = $('<div></div>');
	$(this._canvas).parent().append(this._slider);
}

XAC.InSituSlider.prototype = {
	show: function(left, top, minVal, maxVal, initVal, onSlide, onChange) {
		this._minVal = minVal;
		this._maxVal = maxVal;

		this._slider.slider({
			orientation: "vertical",
			range: "min",
			min: this._minVal,
			max: this._maxVal,
			value: initVal,
			slide: function(event, ui) {
				// var t = (ui.value - FORTE.Delta.SLIDERMIN) / (FORTE.Delta.SLIDERMAX - FORTE.Delta
				//     .SLIDERMIN);
				// t = FORTE.Delta._transfer(t);
				// var delta = FORTE.deltas[this.id];
				// delta._designNew = delta._interpolation.interpolate(t);
				// FORTE.updateDeltas();
				// event.stopPropagation();
				if (onSlide != undefined) {
					onSlide(event, ui);
				}
			},
			change: function(event, ui) {
				if (onChange != undefined) {
					onChange(event, ui);
				}
			}
		});

		offset = 50;
		left = Math.max(0, left - offset);
		top = Math.max(0, top - offset);
		this._slider.css('position', 'absolute');
	    this._slider.css('left', left + 'px');
	    this._slider.css('top', top + 'px');
	    this._slider.css('height', '150px');

		this._slider.show();
	},

	hide: function() {
		this._slider.hide();
	},

	destruct: function() {
		this._canvas.remove(this._slider);
	}
}