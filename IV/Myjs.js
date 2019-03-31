//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;
google.charts.load('current', {'packages':['sankey']});	
// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
        id: 'mapbox.light',
        attribution: mbAttr
    }),
    streets = L.tileLayer(mbUrl, {
        id: 'mapbox.streets',
        attribution: mbAttr
    });
var color = d3.scale.linear()
            .domain([0,1,2,3,4,5,6,10,15,20,100])
            .range(["#ddd", "#ccc", "#bbb", "#aaa", "#999", "#888", "#777", "#666", "#555", "#444", "#333", "#222"]);


var map = L.map('map', {
    center: [lat, lng], // Porto
    zoom: zoom,
    layers: [streets],
    zoomControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: { // optional
        title: "Show me the fullscreen !",
        titleCancel: "Exit fullscreen mode",
        position: 'bottomright'
    }
});

var baseLayers = {
    "Grayscale": grayscale, // Grayscale tile layer
    "Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
    position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
    position: 'bottomright',
	collapsed: false,
    draw: {
        // Available Shapes in Draw box. To disable anyone of them just convert true to false
        polyline: false,
        polygon: false,
        circle: false,
        rectangle: true,
        marker: false,
    }

});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"
//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function(data,cb){
	var self = this;
	var request,_resp;
	importScripts("js/rtree.js");
	if(!self.rt){
		self.rt=RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				_resp=JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	}else{
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));

function clearMap() {
    for (i in map._layers) {
        if (map._layers[i]._path != undefined) {
            try {
                map.removeLayer(map._layers[i]);
            } catch (e) {
                console.log("problem with " + e + map._layers[i]);
            }
        }
    }
}
//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	

map.on('draw:created', function (e) {
	
	clearMap();
	
	var type = e.layerType,
		layer = e.layer;
	
	if (type === 'rectangle') {
		console.log(layer.getLatLngs()); //Rectangle Corners points
		var bounds=layer.getBounds();
		rt.data([[bounds.getSouthWest().lng,bounds.getSouthWest().lat],[bounds.getNorthEast().lng,bounds.getNorthEast().lat]]).
		then(function(d){var result = d.map(function(a) {return a.properties;});
		console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
		
		/*Object.entries(result).forEach(entry => {
		  let key = entry[0];
		  let value = entry[1];
		  //window.alert();
		  console.log(key,value.streetnames);
		  
		});*/
		DrawRS(result);
		sankeyCalculation(result);
		VisualizeWordCloud(result);
		scatterplot(result);
		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map  
});
//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	for (var j=0; j<trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = new Array();			  
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
        polyline.setStyle({
            color: 'red',                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0  
        });
		for(var y = 0; y < TPT.length-1; y=y+2){    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y+1]), parseFloat(TPT[y])]);
		}
	}		
}

function sortByFrequency(arr) {
	var f = {};
	arr.forEach(function(i) { f[i] = 0; });
	var u = arr.filter(function(i) { return ++f[i] == 1; });
	//console.log(u);
	return u.sort(function(a, b) { return f[b] - f[a]; });
}

function draw(words, bounds) {
	// move and scale cloud bounds to canvas
	// bounds = [{x0, y0}, {x1, y1}]
	cWidth = 400;
	cHeight = 300;
	bWidth = bounds[1].x - bounds[0].x;
	bHeight = bounds[1].y - bounds[0].y;
	bMidX = bounds[0].x + bWidth/2;
	bMidY = bounds[0].y + bHeight/2;
	//bDeltaX = bWidth/cWidth;
	//bDeltaY = bHeight/cHeight;
	bDeltaX = cWidth/2 - bounds[0].x + bWidth/2;
	bDeltaY = cHeight/2 - bounds[0].y + bHeight/2;
	//scale = 1 / Math.max(scaleX, scaleY);

	bScale = bounds ? Math.min( cWidth / bWidth, cHeight / bHeight) : 1;
	
	// the library's bounds seem not to correspond to reality?
	// try using .getBBox() instead?
	
	svg = d3.select("#rightside").append("svg")
		.attr("width", cWidth)
		.attr("height", cHeight);
	
	wCloud = svg.append("g")
		.attr("width", 400)
                .attr("height", 300)
                .attr("class", "wordcloud")
                .append("g")
                // without the transform, words words would get cutoff to the left and top, they would
                // appear outside of the SVG area
				.attr("transform", "translate(160,100)")
				//.attr("transform", "translate(" + [bDeltaX, bDeltaY] + ") scale(" + scale + ")") // nah!
                .selectAll("text")
                .data(words)
                .enter().append("text")
				.text(function(d) { return d.text; })
                .style("font-size", function(d) { return d.size + "px"; })
                .style("fill", function(d, i) { return color(i); })
				//.duration(500)
                .attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                });
	
	// TO DO: function to find min and max x,y of all words
	// and use it as the group's bbox
	// then do the transformation
	bbox = wCloud.node(0).getBBox();
	//ctm = wCloud.node().getCTM();
	console.log(
		"bbox (x: " + bbox.x + 
		", y: " + bbox.y + 
		", w: " + bbox.width + 
		", h: " + bbox.height + 
		")"
	);
	
};

function VisualizeWordCloud(trips){
	console.log("hi");
	d3.layout.cloud().clear;
	//var map1 = new Map(); 
	var arr = []
	for (var j=0; j<trips.length; j++) {
		for (var k=0; k<15; k++) {
			arr.push(trips[j].streetnames[k]);
		}
	}
	
	var words = sortByFrequency(arr).map(function(d,i) {
        	return {text: d, size: -i};
        });
	console.log(words);	
	
	var fontName = "Impact",
	cWidth = 400,
	cHeight = 300,
	svg,
	wCloud,
	bbox,
	ctm,
	bScale,
	bWidth,
	bHeight,
	bMidX,
	bMidY,
	bDeltaX,
	bDeltaY;

var cTemp = document.createElement('canvas'),
	ctx = cTemp.getContext('2d');
	ctx.font = "100px " + fontName;
var fRatio = Math.min(cWidth, cHeight) / ctx.measureText(words[0].text).width,
	fontScale = d3.scale.linear()
		.domain([
			d3.min(words, function(d) { return d.size; }), 
			d3.max(words, function(d) { return d.size; })
		])
		//.range([20,120]),
		.range([10,35]), // tbc
	fill = d3.scale.category20();

 d3.layout.cloud()
	.size([cWidth, cHeight])
	.words(words)
	.padding(1) // controls
	.rotate(function() { return ~~(Math.random() * 2) * 90; })
	//.text(function(d) {return d.text;})
	.font(fontName)
	.fontSize(function(d) { return fontScale(d.size) })
	.on("end", draw)
	.start();
}

function sankeyCalculation(trips){
	
	var sourceArr = [];
	var uniqueSrc = [];
	var uniqueDest = [];
	var destArr = [];
	var start,end;
	var i=0,j=0;
	while(i<trips.length){
		start = trips[i].streetnames[0];
		end = trips[i].streetnames[trips[i].streetnames.length-1]; 			
		if(start!=end && start!=undefined && end!=undefined){  
		    sourceArr[j]= start;
            destArr[j]= end;	
			j++;
		}
		i++;	
	}
		
		
	console.log("sdfgh");
	$.each(sourceArr, function(i, el){
    if($.inArray(el, uniqueSrc) === -1) uniqueSrc.push(el);
	});

     
	 $.each(destArr, function(i, el){
    if($.inArray(el, uniqueDest) === -1) uniqueDest.push(el);
	});
	console.log("Source");
	console.log(sourceArr);
    console.log("Destination:");
	console.log(destArr);

	google.charts.setOnLoadCallback(drawChart(sourceArr,destArr));	
}

function drawChart(sourceArr,destArr) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'From');
        data.addColumn('string', 'To');
		data.addColumn('number', 'Weight');
		var length =15;
		if(sourceArr.length<15){
			length=sourceArr.length;
		}
		for(var i=0;i<length;i++){
			data.addRow([sourceArr[i],destArr[i],2]);
		}
        /*data.addRows([
          [ 'A', 'X', 5 ],
          [ 'A', 'Y', 7 ],
          [ 'A', 'Z', 6 ],
          [ 'B', 'X', 2 ],
          [ 'B', 'Y', 9 ],
          [ 'B', 'Z', 4 ]
        ]);*/

        // Sets chart options.
        var options = {
          width: 400,
        };
        // Instantiates and draws our chart, passing in some options.
        var chart = new google.visualization.Sankey(document.getElementById('rightside1'));
        chart.draw(data, options);
}

function scatterplot(e) {

var margin = {top: 20, right: 20, bottom: 30, left: 40},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

    var dataset = d3.nest()
        .key(function (d) { return d.streetnames[0] }).sortKeys(d3.ascending)
        .rollup(function(d) { return {"avduration": d3.mean(d, function (g) { return g.duration; }), "avspeed": d3.mean(d, function (g) { return g.avspeed; })}})
        .entries(e);
        console.log(JSON.stringify(dataset));

    // setup x 
    var xValue = function(d) { return d.value.avspeed;}, // data -> value
        xScale = d3.scaleLinear().range([0, width]), // value -> display
        xMap = function(d) { return xScale(xValue(d));}, // data -> display
        xAxis = d3.axisBottom().scale(xScale);

    // setup y
    var yValue = function(d) { return d.value.avduration;}, // data -> value
        yScale = d3.scaleLinear().range([height, 0]), // value -> display
        yMap = function(d) { return yScale(yValue(d));}, // data -> display
        yAxis = d3.axisLeft().scale(yScale);

    // setup fill color
    var cValue = function(d) { return d.key;},

    color = d3.scaleOrdinal(d3.schemeCategory20);

    // add the graph canvas to the body of the webpage
    var svg = d3.select("#scatterplot").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // add the tooltip area to the webpage
    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 100);

    // don't want dots overlapping axis, so add in buffer to data domain
  xScale.domain([d3.min(dataset, xValue) - 1, d3.max(dataset, xValue) + 1]);
  yScale.domain([d3.min(dataset, yValue) - 1, d3.max(dataset, yValue) + 1]);

  // x-axis
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(0)")
      .attr("y", 17)
      .attr("dy", "0.71em")
      .attr("text-anchor", "start")
      .text("Average Speed");

  // y-axis
  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text("Average Duration");

  // draw dots
  svg.selectAll(".dot")
      .data(dataset)
    .enter().append("circle")
      .attr("class", "dot")
      .attr("r", 3.5)
      .attr("cx", xMap)
      .attr("cy", yMap)
      .style("fill", function(d) { return color(cValue(d));}) 
      .on("mouseover", function(d) {
          tooltip.transition()
               .duration(200)
               .style("opacity", .9);
          tooltip.html(d.key + "<br/> (Average Speed: " + xValue(d) 
	        + ", Average Duration: " + yValue(d) + ")")
               .style("left", (d3.event.pageX + 5) + "px")
               .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", function(d) {
          tooltip.transition()
               .duration(500)
               .style("opacity", 0);
      });

  // draw legend
  var legend = svg.selectAll(".legend")
      .data(color.domain())
    .enter().append("g")
      .attr("class", "legend")
      .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

  // draw legend colored rectangles
  legend.append("rect")
      .attr("x", width - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", color);

  // draw legend text
  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text(function(d) { return d;})

}