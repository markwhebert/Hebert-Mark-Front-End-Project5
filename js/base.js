// Defines a number of global variables and arrays
var markers = [];
var map, defaultBounds, input, searchBox, places, bounds;
var infowindow = new google.maps.InfoWindow();
var marker;
var breezoData;

var bindingsApplied = 'false';

// Defines a "Spot" class and applies the characteristics displayed in the list view
var Spot = function(name, aqi, details) {
    this.name = name;
    this.aqi = aqi;
    this.details = ko.observableArray(details);
}

// Creates the View Model
var viewModel = {
  resultList: []
};

// Pulls the air quality data through BreezoMeter API and pushes the necessary data 
// onto the breezoData array and the resultList inside the viewModel
var breezoMeter = function(lati, long, placeName, placeLoc, map) {
  var bmURL = 'http://api-beta.breezometer.com/baqi/?lat='+lati+'&lon='+long+'&fields=breezometer_aqi,breezometer_color,breezometer_description,dominant_pollutant_text&key=8d84ccb55b3446b28aa40f80d0b4ac3a';

  $.get(bmURL, function(data){
    // breezoData holds the information that will later be displayed in the Google
    // Maps API's InfoWindow
    breezoData.push({
      color: data.breezometer_color,
      aqi: JSON.stringify(data.breezometer_aqi),
      title: placeName + " - " + JSON.stringify(data.breezometer_aqi),
      position: placeLoc,
      name: placeName,
      quality: data.breezometer_description
    });

    // resultList in the viewModel holds the information for the list view
    viewModel.resultList.push(
      new Spot(
        placeName, 
        JSON.stringify(data.breezometer_aqi), 
        [
          data.breezometer_description, 
          data.dominant_pollutant_text.main, 
          data.dominant_pollutant_text.causes, 
          data.dominant_pollutant_text.effects
        ]
      )
    );
  }).error(function(e){
    // handles errors for BreezoMeter API
    window.alert("We are having trouble accessing BreezoMeter"); 
  });
}

// Performs the search functionality through Google Places API
var performSearch = function() {
  this.places = ko.observableArray(searchBox.getPlaces());
  this.places(this.places().slice(0, 10)); // Limits search results to first 10

  // if search box is empty, the process ends
  if (this.places().length == 0) {
    return;
  }
  for (var i = 0, marker; marker = markers[i]; i++) {
    marker.setMap(null);
  }

  // Clears the markers, breezoData and resultList arrays
  markers = [];
  breezoData = [];
  viewModel.resultList = [];

  for (var i = 0, place; place = this.places()[i]; i++) {
    // assigns the latitude and longitude to local variables to be shared with the
    // breezoMeter function
    var lat = place.geometry.location.k;
    var lng = place.geometry.location.D;

    // retreieves data from the BreezoMeter API
    var currentMarker = new breezoMeter(lat, lng, place.name, place.geometry.location, map);

    // changes the map positioning based on the search results
    bounds.extend(place.geometry.location);
  }

  // Checks every 100 milliseconds to see if all of the data has been loaded into
  // the breezoData before creating the new markers  
  var makeMarkers = setInterval(function() {
    if (breezoData.length == this.places().length) {
      for (var i = 0; i < breezoData.length; i++) {
        // creates local variables to display in InfoWindow
        name = breezoData[i].name;
        score = breezoData[i].aqi;
        quality = breezoData[i].quality;

        // creates new marker based on color code from AQI and AQI score
        marker = new StyledMarker({
          styleIcon: new StyledIcon(
            StyledIconTypes.MARKER,{
              color: breezoData[i].color, // Changes marker color based on AQI
              text: breezoData[i].aqi // Attaches and displays the AQI to the marker
            }),
          title: breezoData[i].title, 
          position: breezoData[i].position, 
          map: map,
          animation: google.maps.Animation.DROP, 
          name: breezoData[i].name,
          score: breezoData[i].aqi,
          quality: breezoData[i].quality
        });

        // adds a listener to display the InfoWindow when the marker is clicked
        google.maps.event.addListener(marker, 'click', function() {
          infowindow.setContent('<div><b>'+this.name+'<br>'+this.score+'</b> - '+this.quality+'</div>');
          infowindow.open(map, this);
        });
        
        // pushes the new marker onto the markers array
        markers.push(marker);
      };
      clearInterval(makeMarkers); // clears the timer
    } else if (viewModel.resultList.length > this.places().length) {
      // error handling
      window.alert("Error: breezoData is larger than search results"); 
      clearInterval(makeMarkers); // clears the timer
    }
  }, 100);

// Checks every 100 milliseconds to see if all of the data has been loaded into the
// resultList before calling the viewModel.  
  var callView = setInterval(function() {
    if (viewModel.resultList.length == this.places().length) {
      // makes sure the bindings are only applied once
      if (bindingsApplied != 'true') {
        ko.applyBindings(viewModel);
        bindingsApplied = 'true';
      }
      clearInterval(callView); // clears the timer
    } else if (viewModel.resultList.length > this.places().length) {
      // error handling
      window.alert("Error: resultList is larger than search results");
      clearInterval(callView); // clears the timer
    }
  }, 100);

  map.fitBounds(bounds);
};

function initialize() {
  markers = [];
  
  // gets the new map and assigns it to the map variable
  map = new google.maps.Map(document.getElementById('map-canvas'), {
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  // sets the boundaries of the map
  defaultBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(32.6767, -96.8970),
      new google.maps.LatLng(32.8767, -96.6970));
  map.fitBounds(defaultBounds);

  // Create the search box and link it to the UI element.
  input = document.getElementById('pac-input');
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  searchBox = new google.maps.places.SearchBox(input);

  // Listen for the event fired when the user selects an item from the
  // pick list. Retrieve the matching places for that item.
  google.maps.event.addListener(searchBox, 'places_changed', function() {
    performSearch();
  });

  // Changes the bounds based on the view of the map (when changed)
  google.maps.event.addListener(map, 'bounds_changed', function() {
    bounds = map.getBounds();
    searchBox.setBounds(bounds);
  });

  performSearch();
}

google.maps.event.addDomListener(window, 'load', initialize());
