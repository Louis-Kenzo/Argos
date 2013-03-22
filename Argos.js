/*******************************************************************************
*                                                                              *
*                                     Argos                                    *
*                           Louis-Kenzo Furuya Cahier                          *
*                                                                              *
*******************************************************************************/

/************************************ XPath ***********************************/

function getXPath(element) {
	var xpath = '';

	for ( ; element && element.nodeType == 1; element = element.parentNode ) {
		var id = $(element.parentNode).children(element.tagName).index(element) + 1;
		id > 1 ? (id = '[' + id + ']') : (id = '');
		xpath = '/' + element.tagName.toLowerCase() + id + xpath;
	}

	return xpath;
}

function fromXPath(XPath) {
	var search_result = document.evaluate(XPath,                // Searched XPath expression
	                                      document,             // Context (search) node
	                                      null,                 // Namespace resolver
	                                      XPathResult.ANY_TYPE, // Result type
	                                      null);                // Existing result object
	var result = search_result.iterateNext();
	// ASSERT result != null

	return result; 
}

/***************************** Normal distribution ****************************/

var sigma = 10;
var kernel_support = 3 * sigma;

function normal_distribution(sigma) {
	return function(x) {
		return Math.exp(-0.5 * Math.pow(x/sigma,2)) / (Math.sqrt(2 * Math.PI) * sigma);
	};
}

/***************************** Normal distribution ****************************/

function L2_distance(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x2-x1,2) + Math.pow(y2-y1,2));
}

/********************************** Colormap **********************************/

function smaller_color(c1, c2) {
	return c1.position - c2.position;
}

function colormap(points) {
	var sorted_points = points.sort(smaller_color);

	return function (value) {
		for(var i=1 ; i<sorted_points.length ; ++i) {
			if (value <= sorted_points[i].position) {
				var low  = sorted_points[i-1];
				var high = sorted_points[i];

				var relative_position = (value - low.position) / (high.position - low.position);

				var interpolated = {'r':low.r + relative_position * (high.r - low.r),
				                    'g':low.g + relative_position * (high.g - low.g),
				                    'b':low.b + relative_position * (high.b - low.b),
				                    'a':low.a + relative_position * (high.a - low.a)};

				return interpolated;
			}
		}
	};
}

var jet = colormap([{'position':0,    'r':0,    'g':0,    'b':0.4,  'a':0},
                    {'position':0.33, 'r':0,    'g':0.95, 'b':0.95, 'a':0.3},
                    {'position':0.66, 'r':0.95, 'g':0.95, 'b':0,    'a':0.6},
                    {'position':1,    'r':0.95, 'g':0,    'b':0,    'a':0.8}]);

var hot = colormap([{'position':0,    'r':0,    'g':0,    'b':0, 'a':0},
                    {'position':0.33, 'r':0.95, 'g':0,    'b':0, 'a':0.4},
                    {'position':0.66, 'r':0.95, 'g':0.95, 'b':0, 'a':0.6},
                    {'position':1,    'r':1,    'g':1,    'b':1, 'a':0.8}]);

var hsv = colormap([{'position':0,    'r':0.95, 'g':0,    'b':0,    'a':0},
                    {'position':0.33, 'r':0,    'g':0.95, 'b':0,    'a':0.4},
                    {'position':0.66, 'r':0,    'g':0,    'b':0.95, 'a':0.6},
                    {'position':1,    'r':0.95, 'g':0,    'b':0,    'a':0.8}]);

var fog = colormap([{'position':0, 'r':0, 'g':0, 'b':0, 'a':0.95},
                    {'position':1, 'r':0, 'g':0, 'b':0, 'a':0}]);

/************************************ Pose ************************************/

function Pose(movement_event) {
	this.x         = movement_event.pageX;
	this.y         = movement_event.pageY;
	this.offset_x  = movement_event.offsetX / movement_event.target.clientWidth;;
	this.offset_y  = movement_event.offsetY / movement_event.target.clientHeight;
	this.timestamp = movement_event.timeStamp;
}

Pose.prototype.toString = function() {
	return "(" + this.x.toString() + ", " + this.y.toString() + ")";
}

/************************************ Click ***********************************/

function Click(click_event) {
	this.x         = click_event.pageX;
	this.y         = click_event.pageY;
	this.target    = getXPath(click_event.target);
	this.offset_x  = click_event.offsetX / click_event.target.clientWidth;
	this.offset_y  = click_event.offsetY / click_event.target.clientHeight;
	this.timestamp = click_event.timeStamp;
	this.button    = click_event.which; // 1:left 2:middle 3:right
	this.has_meta  = click_event.metaKey;
}

Click.prototype.toString = function() {
	return "(" + this.x.toString() + ", " + this.y.toString() + ")";
}

/******************************** IntensityMap ********************************/

function IntensityMap(width, height) {
	this.width    = width;
	this.height   = height;
	this.data     = new Float32Array(width * height);
	this.integral = 0;
	this.min      = 0;
	this.max      = 0;
}

IntensityMap.prototype.length = function() {
	return this.width * this.height;
}

IntensityMap.prototype.get_index = function(i) {
	return this.data[i];
}

IntensityMap.prototype.get_pixel = function(x, y) {
	return this.get_index(y * this.width + x);
}

IntensityMap.prototype.get_normalized_pixel = function(x, y) {
	var normalized_pixel = (this.get_pixel(x,y) - this.min) / (this.max - this.min);
	if (isNaN(normalized_pixel)) return 0
	else return normalized_pixel;
}

IntensityMap.prototype.accumulate = function(i, value) {
	this.data[i] += value;
	this.integral += value;

	// Maintain min and max data as we go for normalization
	if (this.data[i] < this.min) this.min = this.data[i];
	if (this.data[i] > this.max) this.max = this.data[i];
}

IntensityMap.prototype.accumulate_pixel = function(x, y, value) {
	this.accumulate(y * this.width + x, value);
}

IntensityMap.prototype.update_density = function(position) {
	// Extract the kernel substract window around the position
	var x_min = Math.max(position.x - kernel_support, 0);
	var x_max = Math.min(position.x + kernel_support, this.width);
	var y_min = Math.max(position.y - kernel_support, 0);
	var y_max = Math.min(position.y + kernel_support, this.height);
	var kernel_width  = x_max - x_min + 1;
	var kernel_height = y_max - y_min + 1;

	// Prepare the kernel function centered on the position
	var kernel = normal_distribution(sigma);

	// Evaluate and add the kernel
	for(var x=0; x<kernel_width; ++x) {
		for(var y=0 ; y<kernel_height ; ++y) {
			// From kernel to global coordinates
			var global_x = x_min + x;
			var global_y = y_min + y;

			// Evaluate the kernel at this point
			var distance = L2_distance(position.x, position.y, global_x, global_y);
			//var value = (kernel_support - distance) / kernel_support;
			var value = kernel(distance);

			// Accumulate the value
			this.accumulate_pixel(global_x, global_y, value);
		}
	}
}

IntensityMap.prototype.render = function(canvas) {
	var context = canvas.getContext("2d");

	// Clear the canvas
	context.clearRect(0, 0, canvas.width, canvas.height);
	var canvas_image = context.getImageData(0, 0, canvas.width, canvas.height);
	var data = canvas_image.data;

	// Prepare a colormap
	var color_map = fog;

	// Render
	for (var x=0 ; x<this.width ; ++x) {
		for (var y=0 ; y<this.height ; ++y) {
			var value = this.get_normalized_pixel(x, y);
			var mapped_rgba = color_map(value);

			data[((this.width * y) + x) * 4]     = mapped_rgba.r * 255; // red
			data[((this.width * y) + x) * 4 + 1] = mapped_rgba.g * 255; // green
			data[((this.width * y) + x) * 4 + 2] = mapped_rgba.b * 255; // blue
			data[((this.width * y) + x) * 4 + 3] = mapped_rgba.a * 255; // alpha
		}
	}

	//  Write rendered image
	context.putImageData(canvas_image, 0, 0);
}

/********************************** ArgosMap **********************************/

function ArgosMap(width, height) {
	this.width  = width;
	this.height = height;
	this.click_intensity_map = new IntensityMap(width, height);
	this.pose_intensity_map  = new IntensityMap(width, height);
}

ArgosMap.prototype.integrate_click = function(click) {
	var recovered_element = fromXPath(click.target);
	var recovered_x = Math.round(recovered_element.offsetLeft 
	                           + recovered_element.clientWidth  * click.offset_x);
	var recovered_y = Math.round(recovered_element.offsetTop 
	                           + recovered_element.clientHeight * click.offset_y);

	this.click_intensity_map.update_density({'x':recovered_x, 'y':recovered_y});
}

ArgosMap.prototype.integrate_pose = function(element_xpath, pose) {
	var recovered_element = fromXPath(element_xpath);
	var recovered_x = Math.round(recovered_element.offsetLeft 
	                           + recovered_element.clientWidth  * pose.offset_x);
	var recovered_y = Math.round(recovered_element.offsetTop 
	                           + recovered_element.clientHeight * pose.offset_y);

	this.pose_intensity_map.update_density({'x':recovered_x, 'y':recovered_y});
}

ArgosMap.prototype.build = function(database) {
	// Incrementally build the click intensity map
	for (var i=0 ; i<database.clicks.length ; ++i) {
		this.integrate_click(database.clicks[i]);
	}

	// Incrementally build the pose intensity map
	for (var element_xpath in database.poses) {
		var recovered_element = fromXPath(element_xpath);
		var in_element_trajectory = database.poses[element_xpath];

		for (var i=0 ; i<in_element_trajectory.length ; ++i) {
			var pose = in_element_trajectory[i];
			this.integrate_pose(element_xpath, pose);
		}
	}
}

ArgosMap.prototype.render = function(canvas) {
	//this.click_intensity_map.render(canvas);
	this.pose_intensity_map.render(canvas);
}

var Argos_visualization;

/******************************** ArgosDatabase *******************************/

function ArgosDatabase() {
	this.clicks = new Array();
	this.poses  = new Array();
}

ArgosDatabase.prototype.record_click = function(click) {
	this.clicks.push(click);
}

ArgosDatabase.prototype.record_pose = function(target_XPath, pose) {
	this.poses[target_XPath].push(pose);
}

var Argos_database = new ArgosDatabase();

/********************************* Monitoring *********************************/

// Movements

function monitor_movements() {
	$("body").mousemove(function(e) {
		process_movement(e);
	});
}

function process_movement(movement_event) {
	var new_pose = new Pose(movement_event);
	var target_xpath = getXPath(movement_event.target);

	if (!(target_xpath in Argos_database.poses)) Argos_database.poses[target_xpath] = new Array();

	Argos_database.record_pose(target_xpath, new_pose);
	Argos_visualization.integrate_pose(target_xpath, new_pose);
	Argos_visualization.render(Argos_visualization_canvas());
}

// Clicks

function monitor_clicks() {
	$(document).click(function(e) {
		process_click(e);
	});
}

function process_click(click_event) {
	var new_click = new Click(click_event);
	Argos_database.record_click(new_click);
	Argos_visualization.integrate_click(new_click);
	Argos_visualization.render(Argos_visualization_canvas());
}

/************************* Visualization infrastructure ************************/

function create_visualization_canvas(element) {
	// Create a container div, as the canvas element can't have 
	var visualization_canvas_container = $('<div class="Argos_visualization_canvas_container"/>');
	visualization_canvas_container.css({
	    "position": "absolute",
	    "top"     : "0px",
	    "left"    : "0px",
	    "width"   : "100%",
	    "height"  : "100%",
	    "zIndex"  : "314159",
	    "pointer-events" : "none"});

	// Add the canvas container to the visualized element
	$(element).append(visualization_canvas_container);

	// Create the visualization canvas
	var visualization_canvas = $('<canvas class="Argos_visualization_canvas" />');
	visualization_canvas.css({
	    "position" : "absolute",
	    "overflow" : "visible",
	    "pointer-events" : "none"});

	// Add the canvas to the canvas container
	visualization_canvas_container.append(visualization_canvas);	

	// Initialize the canvas
	update_visualization_canvas(visualization_canvas);
}

// Setup monitoring of the element to always fit it
$(window).resize(function() {
	update_visualization_canvas(Argos_visualization_canvas());
});

function update_visualization_canvas(canvas) {
	container = $(canvas).parent().get(0);
	parent = $(container).parent().get(0);
	$(canvas).attr("width",  parent.scrollWidth);
	$(canvas).attr("height", parent.scrollHeight);
	$(canvas).css("width",  toString(parent.scrollWidth)  + "px");
	$(canvas).css("height", toString(parent.scrollHeight) + "px");

	// Update visualization
	Argos_visualization = new ArgosMap(parent.scrollWidth, parent.scrollHeight);
	Argos_visualization.build(Argos_database);
	Argos_visualization.render($(canvas).get(0));
}

function visualization_canvas(element) {
	return $(element).children(".Argos_visualization_canvas_container").children(".Argos_visualization_canvas")[0];
}

function Argos_visualization_canvas() {
	return $(".Argos_visualization_canvas").get(0);
}

/********************************** Database **********************************/

// Monitor clicks in the whole document
$(document).ready(function() {
	// Create visualization canvas
	create_visualization_canvas(document.body);

	// Start monitoring clicks
	monitor_clicks();

	// Start monitoring movements
	monitor_movements();
});

/******************************************************************************/