function getWorldData (worldName) {
  // Get the metadata of the map
  $.getJSON(`https://styles.ocap2.com/${worldName}.json`)
    .done(function (styleJson) {
      window.worldMeta = styleJson.metadata;
      return InitMap(styleJson.metadata);
    }).fail(function (jqxhr, textStatus, error) {
      var err = textStatus + ', ' + error;
      console.error('Request Failed: ' + err);
    });
}

function InitMap (worldMeta) {
  $(function () {

    if (!worldMeta) {
      throw new Error('World metadata not found');
    }

    map = L.map('mapContainer', {
      // crs: mapInfos.CRS,
      crs: L.CRS.EPSG3857,
      maxZoom: 19,
      minZoom: 12,
      zoom: 12,
      zoomControl: true,
      center: worldMeta.center,
      attributionControl: false, // set up later
    });


    console.debug('Map initialized', map);
    console.debug('World metadata', worldMeta);


    // Set initial bounds
    var mapBounds = [[
      worldMeta.bounds[0],
      worldMeta.bounds[1],
    ],
    [
      worldMeta.bounds[2],
      worldMeta.bounds[3],
    ]]
    console.debug('Map bounds', mapBounds);

    map.fitBounds(mapBounds, {
      padding: [0, 0],
      maxZoom: 19,
      animate: false,
    })

    // Limit map bounds (panning) at 3x the map size
    var bbox = turf.bboxPolygon(worldMeta.bounds);
    // console.debug('Map bbox', bbox);
    var limitBoundsPoly = turf.transformScale(bbox, 3);
    // console.debug('Map limitBoundspoly', limitBoundsPoly);
    var limitBounds = limitBoundsPoly.geometry.coordinates[0];
    // console.debug('Map limitBounds', limitBounds);
    map.setMaxBounds(limitBounds);



    // ADD TOP RIGHT CONTROLS
    // add control in top right with recent sessions
    const recentSessionsControl = L.control({
      position: 'topright',
    })
    recentSessionsControl.onAdd = (map) => {
      var recentSessions = localStorage.getItem('recentSessions') || '[]';
      // If session search param set, store in cache
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const session = urlParams.get('session');
      if (session) {
        recentSessions = JSON.parse(recentSessions);
        if (!recentSessions.includes(session)) {
          // if not already listed, insert at beginning of array
          recentSessions.unshift(session);
          localStorage.setItem('recentSessions', JSON.stringify(recentSessions));
        } else {
          // move to top if already in array
          recentSessions = recentSessions.filter((s) => s !== session);
          recentSessions.unshift(session);
          localStorage.setItem('recentSessions', JSON.stringify(recentSessions));


        }
      }
      // Use recent missions to populate info window
      var recentSessionsHtml = '<div id="recentSessions" style="background-color: white; padding: 10px;"><h3>Recent Sessions</h3><ul>';
      for (let session of recentSessions || []) {
        if (session === recentSessions[0]) {
          // if first, add a "current" label
          recentSessionsHtml += '<li>Current: <a href="/draw?session=' + session + '">' + session + '</a></li>';
        } else {
          // otherwise, add normally
          recentSessionsHtml += '<li><a href="/draw?session=' + session + '">' + session + '</a></li>';
        }
        // skip any past 7
        if (session === recentSessions[6]) {
          break;
        }
      }
      recentSessionsHtml += '</ul></div>';

      var div = L.DomUtil.create('div', 'recentSessions');
      div.innerHTML = recentSessionsHtml;
      return div;
    }

    // finish adding the top right controls
    recentSessionsControl.addTo(map);
    L.control.gridMousePosition().addTo(map);

    // ADD BOTTOM LEFT CONTROLS
    L.control.scale({
      maxWidth: 200,
      imperial: false
    }).addTo(map);

    // ADD BOTTOM RIGHT CONTROLS
    // set the Leaflet attribution control
    const attributionControl = L.control.attribution({
      position: 'bottomright',
    });
    attributionControl.addAttribution(worldMeta.attribution)
    attributionControl.addTo(map);

    // ADD OTHER
    L.latlngGraticule({
      color: '#777',
      font: '12px/1.5 "Helvetica Neue", Arial, Helvetica, sans-serif',
      fontColor: '#777',
      zoomInterval: [
        { start: 12, end: 13, interval: 10000 },
        { start: 13, end: 16, interval: 1000 },
        { start: 16, end: 20, interval: 100 }
      ]
    }).addTo(map);

    // set up maplibre vector basemap
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    window.maplibre = L.maplibreGL({
      style: 'https://styles.ocap2.com/chernarus.json',
      minZoom: 0,
      maxZoom: 24,
    }).addTo(map);


    if (window.location.hash == '#cities') {
      $.each(mapInfos.cities, function (index, city) {
        L.marker([city.y, city.x]).addTo(map).bindPopup(city.name);
      });
    }


    // Function to update draw colors based on the selected color
    window.DRAW_COLOR = '#3388ff';
    function updateDrawColors (color) {
      DRAW_COLOR = color;
    }


    // load w/ content
    async function fetchAvailableMarkers () {
      return fetch('/markers')
        .then((response) => response.json())
        .then((data) => {
          console.debug('Loaded markers', data)
          // log sum of count of markers in each key of object
          var total = 0;
          for (let key in data) {
            total += data[key].length;
          }
          console.debug('Total markers', total);
          return data;
        });
    }


    fetchAvailableMarkers().then(async (markers) => {

      var markerSelectContainer = document.getElementById('marker-select-container');
      // Add markers to the marker select
      for (let addon of Object.keys(markers)) {
        // Add a header for the addon
        var addonHeader = document.createElement('h3');
        addonHeader.innerHTML = addon;
        markerSelectContainer.appendChild(addonHeader);
        // Add a container for the addon's markers
        var markerSelect = document.createElement('div');
        markerSelect.className = 'marker-select';
        markerSelectContainer.appendChild(markerSelect);

        // Add each marker to the marker select
        for (let marker of markers[addon]) {
          var markerOption = document.createElement('div');
          markerOption.className = 'marker-select-option';
          markerOption.innerHTML = `<span class="marker-select-name">${marker.name}</span><img src="${marker.url}" class="marker-select-image" />`;
          markerOption.addEventListener('click', function () {
            // Set the marker image
            var markerImage = document.getElementById('image-url');
            markerImage.value = marker.url;
            // Set the marker description
            var markerDescription = document.getElementById('description');
            markerDescription.value = marker.description;
          });
          markerSelect.appendChild(markerOption);
        }
      }
    });

    // Function to prompt the user to select a marker
    function promptMarkerSelection () {
      // open a dialog to select a marker
      Swal.fire({
        title: 'Select a Marker',
        html: document.getElementById('marker-select-container'),
        showConfirmButton: false,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        cancelButtonColor: '#d33',
        onOpen: () => {
          // Add a listener to the marker select button
          document.getElementById('marker-select-button').addEventListener('click', function () {
            Swal.close();
          });
        }
      });
    }

    promptMarkerSelection()


    // Update the 'pm:create' event listener
    map.on('pm:create', function (event) {
      console.log(event.shape);
      var layer = event.layer;
      var imageUrl;
      var description;

      if (event.shape === 'Marker') {
        Swal.fire({
          title: 'Set Marker Image and Description',
          html: `
                    <p>Marker URL</p>
                    <input id="image-url" class="swal2-input" placeholder="Enter the URL of the marker image">
                    <p>You can also click here to select a marker image</p>
                    <button id="marker-select-button" class="swal2-input" style="width: 100%; height: 50px; border: 1px solid #ccc; border-radius: 5px; background-color: white; margin-bottom: 10px;" onClick="promptMarkerSelection()">Select Marker</button>
                    <textarea id="description" rows="4" class="swal2-textarea" placeholder="Enter a description for the drawing"></textarea>
                  `,
          showCancelButton: true,
          confirmButtonText: 'Set',
          cancelButtonText: 'Cancel',
          allowOutsideClick: false,
          preConfirm: () => {
            imageUrl = document.getElementById('image-url').value;
            description = document.getElementById('description').value;
            if (!imageUrl || imageUrl == '') {
              imageUrl = 'https://i.imgur.com/SY0C1lx.png';
            }
            var icon = L.icon({
              iconUrl: imageUrl,
              iconSize: [25, 41] // Adjust the size of the icon if needed
            });
            layer.setIcon(icon);

            if (description.trim() !== '') {
              layer.description = description;
              layer.bindPopup(description).openPopup();
            }
          }
        }).then((result) => {
          // Get the selected color from the color picker
          var selectedColor = $('#colorPicker').spectrum('get').toHexString();

          // Send the drawing data to the server
          saveDrawingToServer(layer, description, selectedColor, imageUrl);
        });
      } else {

        Swal.fire({
          title: 'Enter a description for the drawing:',
          input: 'textarea',
          inputPlaceholder: 'Description',
          showCancelButton: true,
          confirmButtonText: 'Save',
          cancelButtonText: 'Cancel',
          allowOutsideClick: false
        }).then((result) => {
          if (result.isConfirmed) {
            description = result.value;
            layer.description = description;
            layer.bindPopup(description);

            // create tooltip
            layer.bindTooltip(description, {
              permanent: true,
              direction: 'bottom',
              className: 'drawingTooltip',
            });
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Cancelled, do nothing
          }
        }).then((result) => {
          // Get the selected color from the color picker
          var selectedColor = $('#colorPicker').spectrum('get').toHexString();
          layer.setStyle({ color: selectedColor }); // Set the color of the layer


          // Send the drawing data to the server
          saveDrawingToServer(layer, description, selectedColor, imageUrl);
        });
      }
    });


    // Function to update draw colors based on the selected color
    window.DRAW_COLOR = '#3388ff';
    function updateDrawColors (color) {
      DRAW_COLOR = color;
    }

    // Function to send the drawing data to the server
    function saveDrawingToServer (layer, description, color, imageUrl) {
      // get session search param from current url
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const session = urlParams.get('session');
      $.ajax({
        url: '/drawings/' + session,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          data: layer.toGeoJSON(),
          description: description,
          color: color,
          imageUrl: imageUrl, // Include the imageUrl in the request
        }),
        success: function (response) {
          // Get the ID of the saved drawing from the server response
          const drawingId = response.id;

          // Set the ID as a property of the layer
          layer.drawingId = drawingId;

          console.log('Drawing saved successfully.');
        },
        error: function (xhr, status, error) {
          console.error('Error saving drawing:', error);
        },
      });
    }


    // Event listener for drawing deletion
    map.on('pm:remove', function (event) {
      console.log('Drawing deleted. ');
      var layer = event.layer;
      deleteDrawingOnServer(layer);
    });

    // Function to delete a drawing from the server
    function deleteDrawingOnServer (layer) {
      console.log('Deleting drawing...');
      console.log(layer.drawingId);
      const drawingId = layer.drawingId;
      if (drawingId) {
        $.ajax({
          url: `/drawings/${drawingId}`,
          type: 'DELETE',
          success: function () {
            console.log('Drawing deleted successfully.');
          },
          error: function (xhr, status, error) {
            console.error('Error deleting drawing:', error);
          },
        });
      }
    }

    // Function to export the drawings
    function exportDrawings () {
      window.location.href = '/export';
    }

    // Function to import the drawings
    function importDrawings () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = function (event) {
        var file = event.target.files[0];
        if (file) {
          var reader = new FileReader();
          reader.onload = function (e) {
            var fileData = e.target.result;
            importDrawingsFromFile(fileData);
          };
          reader.readAsText(file);
        }
      };

      input.click();
    }


    // Function to import the drawings from a file
    function importDrawingsFromFile (fileData) {
      $.ajax({
        url: '/import',
        type: 'POST',
        contentType: 'application/json',
        data: fileData,
        success: function () {
          console.log('Drawings imported successfully.');
          // Reload the page to display the imported drawings
          location.reload();
        },
        error: function (xhr, status, error) {
          console.error('Error importing drawings:', error);
        },
      });
    }


    // Load drawings from the server
    loadDrawingsFromServer();

    function loadDrawingsFromServer () {
      // get session search param from current url
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const session = urlParams.get('session');
      $.ajax({
        url: `/drawings/${session}`,
        type: 'GET',
        dataType: 'json',
        success: function (drawings) {
          drawings.forEach(function (drawing) {
            var layer;
            if (drawing.data.geometry.type === 'Point') {
              var icon = L.icon({
                iconUrl: drawing.imageUrl,
                iconSize: [25, 41], // Adjust the size of the icon if needed
              });
              layer = L.geoJSON(drawing.data, {
                pointToLayer: function (geoJsonPoint, latlng) {
                  return L.marker(latlng, {
                    icon: icon
                  });
                },
              });
            } else {
              layer = L.geoJSON(drawing.data, {
                style: {
                  color: drawing.color,
                },
              });
            }
            layer.eachLayer(function (l) {
              var popup = L.popup({
                maxWidth: 200,
                className: 'drawingPopup',
              });
              popup.setContent(drawing.description);
              l.bindPopup(popup);

              // create tooltip
              l.bindTooltip(drawing.description, {
                permanent: true,
                direction: 'bottom',
                className: 'drawingTooltip',
              });

              l.drawingId = drawing.id; // Set the drawing ID as a property of the layer
            });

            layer.addTo(map);
          });
          console.log('Drawings loaded successfully.');
        },
        error: function (xhr, status, error) {
          console.error('Error loading drawings:', error);
        },
      });
      checkIt();
    }

    function checkIt () {
      $.ajax({
        url: '/loginStatus',
        type: 'GET',
        dataType: 'json',
        success: function (response) {
          if (response.isLoggedIn) {
            map.pm.addControls({
              position: 'topleft',
              drawCircle: false,
              drawRectangle: true,
              drawCircleMarker: false,
              tooltips: true,
              drawPolyline: true,
              drawPolygon: true,
              drawText: false,
            });
            // Add color picker functionality
            var colorPicker = $('<input type="text" id="colorPicker" />');
            var logout = $('<div class="button-container" title="Logout"><a class="leaflet-buttons-control-button" role="button" tabindex="0" href="/logout"><div class="control-icon leaflet-pm-icon-logout"></div></a></div>');

            // Create the import button
            var importButton = $('<div class="button-container" title="Import Drawings"><a class="leaflet-buttons-control-button" role="button" tabindex="0" id="importButton"><div class="control-icon leaflet-pm-icon-import"></div></a></div>');
            $('.leaflet-pm-toolbar:last').append(importButton);

            // Create the export button
            var exportButton = $('<div class="button-container" title="Export Drawings"><a class="leaflet-buttons-control-button" role="button" tabindex="0" id="exportButton"><div class="control-icon leaflet-pm-icon-export"></div></a></div>');
            $('.leaflet-pm-toolbar:last').append(exportButton);
            $('.leaflet-pm-toolbar:last').append(logout);
            $('.leaflet-pm-toolbar:first').prepend(colorPicker);
            $('#colorPicker').spectrum({
              color: '#3388ff', // Initial color
              preferredFormat: 'hex',
              showInput: true,
              change: function (color) {
                var selectedColor = color.toHexString();
                updateDrawColors(selectedColor);
              },
            });

            // Event listener for export button click
            $('#exportButton').on('click', function () {
              exportDrawings();
            });

            // Event listener for import button click
            $('#importButton').on('click', function () {
              importDrawings();
            });
          }
        },
        error: function (xhr, status, error) {
          console.error('Error checking login status:', error);
        },
      });
    }
  });

}