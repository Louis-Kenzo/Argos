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

var sigma_x = 10;
var sigma_y = 10;
var cutoff_x = 3 * sigma_x;
var cutoff_y = 3 * sigma_y;

function normal_distribution(mu_x, mu_y, sigma_x, sigma_y) {
	return function(x,y) {
		return Math.exp(- 0.5 * Math.pow(x-mu_x,2)/Math.pow(sigma_x,2) 
			          - 0.5 * Math.pow(y-mu_y,2)/Math.pow(sigma_y,2)) / (2 * Math.PI * sigma_x * sigma_y);
	};
}

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

}

/******************************** ArgosDatabase *******************************/

// TODO

var clicks = new Array();
var trajectory = new Array();

/********************************* Monitoring *********************************/

// Movements

function monitor_movements() {
	$("body").mousemove(function(e) {
		process_movement(e);
		visualize();
	});
}

function process_movement(movement_event) {
	var new_pose = new Pose(movement_event);
	var target_xpath = getXPath(movement_event.target);

	if (!(target_xpath in trajectory)) trajectory[target_xpath] = new Array();

	trajectory[target_xpath].push(new_pose);
}

// Clicks

function monitor_clicks() {
	$(document).click(function(e) {
		process_click(e);
		visualize();
	});
}

function process_click(click_event) {
	var new_click = new Click(click_event);
	clicks.push(new_click);
}

/****************************** DensityEstimation *****************************/

function click_intensity_kernel(canvas, click) {
	var recovered_element = fromXPath(click.target);
	var recovered_x = Math.round(recovered_element.offsetLeft + recovered_element.clientWidth  * click.offset_x);
	var recovered_y = Math.round(recovered_element.offsetTop  + recovered_element.clientHeight * click.offset_y);

	// 
	var x_min = Math.max(recovered_x - cutoff_x, 0);
	var x_max = Math.min(recovered_x + cutoff_x, canvas.width);
	var y_min = Math.max(recovered_y - cutoff_y, 0);
	var y_max = Math.min(recovered_y + cutoff_y, canvas.height);
	var kernel_width  = x_max - x_min + 1;
	var kernel_height = y_max - y_min + 1;
	//console.log("(" + recovered_x + "," + recovered_y + ")" + " " + "(" + x_min + "-" + x_max + "," + y_min + "-" + y_max  + ")");

	// Get access to the canvas pixel data
	var context = canvas.getContext("2d");
	var canvas_image = context.getImageData(x_min, y_min, kernel_width, kernel_height);
	var data = canvas_image.data;

	//
	var kernel = normal_distribution(recovered_x, recovered_y, sigma_x, sigma_y);

	// 
	for(var y=0 ; y<kernel_height ; ++y) {
		for(var x=0; x<kernel_width; ++x) {
			var global_x = x_min + x;
			var global_y = y_min + y;
			var value = (cutoff_x - Math.sqrt(Math.pow(recovered_x-global_x,2)+Math.pow(recovered_y-global_y,2))) / cutoff_x;
			//var value = kernel(global_x, global_y);

			canvas_image.data[((kernel_width * y) + x) * 4]     = 255; // red
			canvas_image.data[((kernel_width * y) + x) * 4 + 1] = 0;   // green
			canvas_image.data[((kernel_width * y) + x) * 4 + 2] = 0;   // blue
			canvas_image.data[((kernel_width * y) + x) * 4 + 3] = 255 * value; // alpha
		}
	}

	// Draw the visualization
	context.putImageData(canvas_image, x_min, y_min);
}

/******************************** Visualization *******************************/

function visualize_movements(canvas) {
	var context = canvas.getContext("2d");

	for (var element_xpath in trajectory) {
		var recovered_element = fromXPath(element_xpath);
		var in_element_trajectory = trajectory[element_xpath];
		context.beginPath();

		// First pose
		var first_pose = in_element_trajectory[0];
		context.moveTo(recovered_element.offsetLeft + recovered_element.clientWidth  * first_pose.offset_x, 
		               recovered_element.offsetTop  + recovered_element.clientHeight * first_pose.offset_y);
		
		for (var i=0 ; i<in_element_trajectory.length ; ++i) {
			var pose = in_element_trajectory[i];
			context.lineTo(recovered_element.offsetLeft + recovered_element.clientWidth  * pose.offset_x, 
		                     recovered_element.offsetTop  + recovered_element.clientHeight * pose.offset_y);
		}

		context.stroke();
	}
}

function visualize_clicks(canvas) {
	var context = canvas.getContext("2d");

	// Clear it
	context.clearRect(0, 0, canvas.width, canvas.height);

	// Allocate an intensity map
	var intensity_map_buffer = new ArrayBuffer(canvas.width * canvas.height);
	var intensity_map = new DataView(intensity_map_buffer);
	//var intensity_map = new IntensityMap(canvas.width, canvas.height);

	// Build an intensity using kernel density estimation
	for (var i=0 ; i<clicks.length ; ++i) {
		click_intensity_kernel(canvas, clicks[i]);
		//intensity_map.setFloat32(b, v);
		//intensity_map.getFloat32(b);
	}

	// Normalize the intensity array
	// TODO

	// Render the intensity array
	// TODO
}

/******************************** Visualization *******************************/

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
	update_visualization_canvas($(".Argos_visualization_canvas"));
});

function update_visualization_canvas(canvas) {
	container = $(canvas).parent()[0];
	parent = $(container).parent()[0];
	canvas.attr("width",  parent.scrollWidth);
	canvas.attr("height", parent.scrollHeight);
	canvas.css("width",  toString(parent.scrollWidth)  + "px");
	canvas.css("height", toString(parent.scrollHeight) + "px");

	// Update visualization
	visualize();
}

function visualization_canvas(element) {
	return $(element).children(".Argos_visualization_canvas_container").children(".Argos_visualization_canvas")[0];
}

function visualize() {
	var canvas  = visualization_canvas($("body"));

	visualize_clicks(canvas);
	//visualize_movements(canvas);
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