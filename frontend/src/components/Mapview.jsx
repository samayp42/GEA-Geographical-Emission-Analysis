import React, { useEffect, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import './Mapview.css';

// Add WeatherCard import at the top
import WeatherCard from './WeatherCard';

function Mapview({ results, pieChartData, colors, weatherData }) {  // Add weatherData to props
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapLoaded = useRef(false);
  const markersRef = useRef([]);

  useEffect(() => {
    // Define updateMap function first before using it
    const updateMap = () => {
      if (!map.current || !mapLoaded.current) {
        console.log('Map not ready yet, cannot update');
        return;
      }
    
      console.log('Updating map with results:', results);
    
      // Clear any existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    
      // Remove existing sources and layers
      try {
        if (map.current.getSource('area-data')) {
          // First remove any layers that use this source
          if (map.current.getLayer('poi-points')) {
            map.current.removeLayer('poi-points');
          }
          if (map.current.getLayer('boundary-fill')) {
            map.current.removeLayer('boundary-fill');
          }
          if (map.current.getLayer('boundary-line')) {
            map.current.removeLayer('boundary-line');
          }
          // Then remove the source
          map.current.removeSource('area-data');
        }
        // Add cleanup for poi-boundary
        if (map.current.getSource('poi-boundary')) {
          if (map.current.getLayer('poi-boundary-line')) {
            map.current.removeLayer('poi-boundary-line');
          }
          map.current.removeSource('poi-boundary');
        }
      } catch (e) {
        console.log('Error removing existing layers/sources:', e);
      }
    
      // If we have a bounding box, fit the map to it
      if (results.bbox) {
        map.current.fitBounds([
          [results.bbox[0], results.bbox[1]], // Southwest corner
          [results.bbox[2], results.bbox[3]]  // Northeast corner
        ], {
          padding: 50,
          duration: 1000,
          maxZoom: 12, // Limit maximum zoom level
          minZoom: 10  // Limit minimum zoom level
        });
      }
    
      // If we have a GeoJSON, add it to the map
      if (results?.geojson) {
        try {
          console.log('Adding GeoJSON to map:', results.geojson);
          
          // Add the GeoJSON source
          map.current.addSource('area-data', {
            'type': 'geojson',
            'data': results.geojson
          });
          
          // Add a fill layer for the boundary
          map.current.addLayer({
            'id': 'boundary-fill',
            'type': 'fill',
            'source': 'area-data',
            'filter': ['==', ['get', 'type'], 'boundary'],
            'paint': {
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': ['get', 'fillOpacity']
            }
          });
          
          // Add a line layer for the boundary with increased width and opacity
          map.current.addLayer({
            'id': 'boundary-line',
            'type': 'line',
            'source': 'area-data',
            'filter': ['==', ['get', 'type'], 'boundary'],
            'paint': {
              'line-color': '#FF0000', // Changed to red for better visibility
              'line-width': 3, // Increased width
              'line-opacity': 1.0 // Full opacity
            }
          });
          
          // Add a circle layer for POIs
          map.current.addLayer({
            'id': 'poi-points',
            'type': 'circle',
            'source': 'area-data',
            'filter': ['==', ['get', 'type'], 'poi'],
            'paint': {
              'circle-radius': 8,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff'
            }
          });
          
          // Add popups for POIs
          map.current.on('click', 'poi-points', (e) => {
            if (!e.features.length) return;
            
            // First, remove any existing popups to prevent duplicates
            const existingPopups = document.querySelectorAll('.maplibregl-popup');
            existingPopups.forEach(popup => popup.remove());
            
            // Update the popup content generation
            const feature = e.features[0];
            const properties = feature.properties;
            const coordinates = e.lngLat;
            
            // Debug: Log the properties to see what we're getting
            console.log('POI Properties:', properties);
            
            // Extract address components
            const address = properties.address ? [
                properties.address.street,
                properties.address.housenumber,
                properties.address.postcode,
                properties.address.city
            ].filter(Boolean).join(', ') : '';
            
            // Extract other properties
            const operator = properties.operator || '';
            const opening_hours = properties.tags?.opening_hours || '';
            const capacity = properties.tags?.capacity || '';
            const start_date = properties.tags?.start_date || '';
            const phone = properties.tags?.phone || '';
            const website = properties.tags?.website || '';
            
            // Create popup content with improved styling
            let popupContent = `
              <div class="popup-content">
                <h3>${properties.name || properties.display_name || 'Unnamed Location'}</h3>
                <div class="category-label" style="background-color: ${properties.color}; color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">
                  ${properties.display_name}
                </div>
                <p class="category-name">${properties.category.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</p>
            `;
            
            // Add emissions information if available
            if (properties.pollutants && properties.pollutants.length > 0) {
              // Parse pollutants if it's a string
              let pollutantsList = properties.pollutants;
              if (typeof properties.pollutants === 'string') {
                try {
                  pollutantsList = JSON.parse(properties.pollutants);
                } catch (e) {
                  console.error('Error parsing pollutants:', e);
                  pollutantsList = [properties.pollutants]; // Treat as single item if parsing fails
                }
              }
              
              popupContent += `<div class="emissions-section">
                <h4>Potential Pollutants:</h4>
                <div class="pollutants-list">`;
              
              // Display each pollutant as a tag
              pollutantsList.forEach(pollutant => {
                popupContent += `<span class="pollutant-item">${pollutant}</span>`;
              });
              
              popupContent += `</div></div>`;
              
              // Add air quality data if available
              if (properties.air_quality) {
                const airQuality = properties.air_quality;
                const aqiInfo = airQuality.aqi_info;
                
                popupContent += `
                  <div class="air-quality-section">
                    <h4>Current Air Quality:</h4>
                    <div class="aqi-indicator" style="background-color: ${aqiInfo.color}; color: white; padding: 8px; border-radius: 4px; margin-bottom: 10px;">
                      <strong>AQI: ${airQuality.aqi}</strong> - ${aqiInfo.level}
                    </div>
                    <p class="aqi-description">${aqiInfo.description}</p>`;
                
                // Add pollutant measurements if available
                if (Object.keys(airQuality.components).length > 0) {
                  popupContent += `<div class="pollutant-measurements">
                    <h5>Pollutant Measurements:</h5>
                    <table class="measurements-table" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <th style="text-align: left; padding: 4px; border-bottom: 1px solid #ddd;">Pollutant</th>
                        <th style="text-align: right; padding: 4px; border-bottom: 1px solid #ddd;">Value</th>
                      </tr>`;
                  
                  Object.values(airQuality.components).forEach(component => {
                    // Determine color based on level (1-5)
                    const levelColors = ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C'];
                    const color = levelColors[component.level - 1] || '#808080';
                    
                    popupContent += `
                      <tr>
                        <td style="text-align: left; padding: 4px; border-bottom: 1px solid #eee;">${component.name}</td>
                        <td style="text-align: right; padding: 4px; border-bottom: 1px solid #eee; color: ${color};"><strong>${component.value}</strong> ${component.unit}</td>
                      </tr>`;
                  });
                  
                  popupContent += `</table></div>`;
                }
                
                popupContent += `</div>`;
              }
            }
            
            // Add primary concerns if available
            if (properties.primary_concerns && Array.isArray(properties.primary_concerns) && properties.primary_concerns.length > 0) {
              popupContent += `<div class="concerns-section">
                <h4>Primary Concerns:</h4>
                <ul>`;
              
              properties.primary_concerns.forEach(concern => {
                popupContent += `<li>${concern}</li>`;
              });
              
              popupContent += `</ul></div>`;
            }
            
            // Add the rest of the existing information
            if (properties.description) popupContent += `<p><strong>Description:</strong> ${properties.description}</p>`;
            if (address) popupContent += `<p><strong>Address:</strong> ${address}</p>`;
            if (operator) popupContent += `<p><strong>Operator:</strong> ${operator}</p>`;
            if (opening_hours) popupContent += `<p><strong>Hours:</strong> ${opening_hours}</p>`;
            if (capacity) popupContent += `<p><strong>Capacity:</strong> ${capacity}</p>`;
            if (start_date) popupContent += `<p><strong>Established:</strong> ${start_date}</p>`;
            
            // Add contact information if available
            if (phone || website) {
              popupContent += `<div class="popup-contact">`;
              if (phone) popupContent += `<p><strong>Phone:</strong> ${phone}</p>`;
              if (website) popupContent += `<p><strong>Website:</strong> <a href="${website}" target="_blank">${website}</a></p>`;
              popupContent += `</div>`;
            }
            
            popupContent += `</div>`;
            
            // Create popup with enhanced content and wider width
            new maptilersdk.Popup({
              maxWidth: '320px', // Increase the max width
              className: 'custom-popup'
            })
              .setLngLat(coordinates)
              .setHTML(popupContent)
              .addTo(map.current);
          });
          
          // Change cursor on hover
          map.current.on('mouseenter', 'poi-points', () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });
          
          map.current.on('mouseleave', 'poi-points', () => {
            map.current.getCanvas().style.cursor = '';
          });
          
          console.log('Successfully added GeoJSON layers to map');
        } catch (e) {
          console.error('Error adding GeoJSON to map:', e);
        }
      } else if (results?.pois) {
        // Fallback to old method if no GeoJSON but we have POIs
        console.log('No GeoJSON found, falling back to POI markers');
        
        // Calculate bounds for all POIs
        const bounds = new maptilersdk.LngLatBounds();
        let hasValidCoordinates = false;
        
        Object.values(results.pois).forEach(pois => {
          pois.forEach(poi => {
            if (poi.lat && poi.lon) {
              bounds.extend([poi.lon, poi.lat]);
              hasValidCoordinates = true;
            }
          });
        });

        // Create a boundary polygon from the bounds
        if (hasValidCoordinates) {
          // Fit map to bounds
          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 13,  // Limit maximum zoom level
            minZoom: 10,  // Limit minimum zoom level
            duration: 1000
          });
          
          // Create a GeoJSON polygon from the bounds
          const sw = bounds.getSouthWest();
          const se = new maptilersdk.LngLat(bounds.getEast(), bounds.getSouth());
          const ne = bounds.getNorthEast();
          const nw = new maptilersdk.LngLat(bounds.getWest(), bounds.getNorth());
          
          // Add boundary source and layer
          map.current.addSource('poi-boundary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [sw.lng, sw.lat],
                  [se.lng, se.lat],
                  [ne.lng, ne.lat],
                  [nw.lng, nw.lat],
                  [sw.lng, sw.lat] // Close the polygon
                ]]
              }
            }
          });

          map.current.addLayer({
            id: 'poi-boundary-line',
            type: 'line',
            source: 'poi-boundary',
            paint: {
              'line-color': '#FF0000',
              'line-width': 3,
              'line-opacity': 1.0
            }
          });
        }

        // Create a mapping of categories to colors
        const categoryColors = {};
        if (pieChartData && Array.isArray(pieChartData)) {
          // First, filter out items with zero value to match pie chart rendering
          const filteredPieData = pieChartData.filter(item => item.value > 0);
          
          // Then create color mapping using the same logic as in App.jsx
          filteredPieData.forEach((item, index) => {
            const category = typeof item.name === 'object' ? Object.keys(item.name)[0] : item.name;
            // Use the color from the pie chart data if available, otherwise fall back to the colors array
            categoryColors[category] = item.color || colors[index % colors.length];
          });
        }
        
        // Process POIs and add markers
        Object.entries(results.pois).forEach(([category, pois]) => {
          // Get color for this category or use default
          const markerColor = categoryColors[category] || '#FF0000';
          
          pois.forEach(poi => {
            // Check if POI has valid coordinates
            if (poi.lat && poi.lon) {
              // Create custom marker element
              const el = document.createElement('div');
              el.className = 'color-coded-marker';
              el.style.backgroundColor = markerColor;
              el.style.width = '14px';
              el.style.height = '14px';
              el.style.borderRadius = '50%';
              el.style.border = '2px solid white';
              el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
              
              // Create marker with popup
              const marker = new maptilersdk.Marker({element: el})
                .setLngLat([poi.lon, poi.lat])
                .addTo(map.current);
              
              // Add popup with POI name and category
              const popup = new maptilersdk.Popup({
                offset: 25,
                closeButton: true,
                className: 'custom-popup'
              }).setHTML(`
                <div class="popup-content">
                  <h4>${poi.tags?.name || category}</h4>
                  <p>Category: ${category}</p>
                </div>
              `);
              
              marker.setPopup(popup);
              markersRef.current.push(marker);
            }
          });
        });
      }
    };

    // Initialize map only once
    if (!map.current && mapContainer.current) {
      console.log('Initializing map...');
      
      // Set API key
      maptilersdk.config.apiKey = process.env.REACT_APP_MAPTILER_API_KEY;
      
      // Initialize Maptiler map
      map.current = new maptilersdk.Map({
        container: mapContainer.current,
        style: maptilersdk.MapStyle.STREETS,
        center: [0, 0],
        zoom: 0.5,
        maxZoom: 16,    // Add maximum zoom constraint
        minZoom: 2      // Add minimum zoom constraint
      });

      // Add navigation controls
      map.current.addControl(new maptilersdk.NavigationControl());
      
      map.current.on('load', () => {
        console.log('Map style loaded');
        mapLoaded.current = true;
        if (results) updateMap();
      });
    }

    // Update map when results change
    if (results && map.current) {
      if (mapLoaded.current) {
        updateMap();
      } else {
        map.current.once('load', updateMap);
      }
    }
  }, [results, pieChartData, colors]);

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
      <WeatherCard weatherData={weatherData} />
    </div>
  );
}

export default Mapview;