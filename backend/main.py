import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv
import json
import requests
import math
from urllib.parse import quote
from datetime import datetime

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash-lite')

def get_pois_overpass(area_name, city_name, poi_categories):
    """Get POIs using Overpass API for multiple categories within a 1km radius."""
    overpass_url = "https://overpass-api.de/api/interpreter"

    # --- 1. Define Search Area ---
    geocode_query = f"{area_name}, {city_name}"
    geocode_url = f"https://nominatim.openstreetmap.org/search?q={quote(geocode_query)}&format=json&limit=1"
    try:
        geocode_response = requests.get(geocode_url, headers={'User-Agent': 'MapMind/1.0'})
        geocode_response.raise_for_status()
        geocode_data = geocode_response.json()
    except requests.RequestException as e:
        print(f"Geocoding Error: {str(e)}")
        return {"error": f"Geocoding failed: {str(e)}"}

    if not geocode_data:
        return {"error": "Could not geocode area/city"}

    geocode_lat = float(geocode_data[0].get('lat'))
    geocode_lon = float(geocode_data[0].get('lon'))
    print(f"Geocoded {area_name}, {city_name} to {geocode_lat}, {geocode_lon}")
    # Get bounding box for the area
    bbox = None
    if 'boundingbox' in geocode_data[0]:
        bbox_raw = geocode_data[0]['boundingbox']
        bbox = [float(bbox_raw[2]), float(bbox_raw[0]), float(bbox_raw[3]), float(bbox_raw[1])]
    else:
        radius_deg = 0.009
        bbox = [
            geocode_lon - radius_deg,
            geocode_lat - radius_deg,
            geocode_lon + radius_deg,
            geocode_lat + radius_deg
        ]

    # --- 2. Query for POIs by Category ---
    all_pois = {}
    
    # Expanded query to include emission sources within 5km radius
    overpass_query = f"""
    [out:json][timeout:300];
    (
        // 1. Industrial & Manufacturing
        nwr["industrial"="oil"](around:5000,{geocode_lat},{geocode_lon});
        nwr["industrial"="gas"](around:5000,{geocode_lat},{geocode_lon});
        nwr["industrial"="gas_plant"](around:5000,{geocode_lat},{geocode_lon});
        nwr["industrial"="refinery"](around:5000,{geocode_lat},{geocode_lon});
        nwr["man_made"="works"](around:5000,{geocode_lat},{geocode_lon});
        nwr["man_made"="chimney"](around:5000,{geocode_lat},{geocode_lon});
        
        // 2. Power Generation
        nwr["power"="plant"](around:5000,{geocode_lat},{geocode_lon});
        nwr["plant:source"](around:5000,{geocode_lat},{geocode_lon});
        nwr["power"="substation"](around:5000,{geocode_lat},{geocode_lon});
        
        // 3. Fossil Fuel Extraction & Storage
        nwr["man_made"="oil_well"](around:5000,{geocode_lat},{geocode_lon});
        nwr["man_made"="gas_well"](around:5000,{geocode_lat},{geocode_lon});
        nwr["man_made"="storage_tank"](around:5000,{geocode_lat},{geocode_lon});
        nwr["landuse"="quarry"](around:5000,{geocode_lat},{geocode_lon});
        nwr["landuse"="mine"](around:5000,{geocode_lat},{geocode_lon});
        
        // 4. Transportation & Vehicle Emissions
        nwr["aeroway"="aerodrome"](around:5000,{geocode_lat},{geocode_lon});
        nwr["railway"="yard"](around:5000,{geocode_lat},{geocode_lon});
        nwr["amenity"="bus_station"](around:5000,{geocode_lat},{geocode_lon});
        nwr["amenity"="fuel"](around:5000,{geocode_lat},{geocode_lon});
        
        // 5. Waste Processing & Landfills
        nwr["landuse"="landfill"](around:5000,{geocode_lat},{geocode_lon});
        nwr["man_made"="wastewater_plant"](around:5000,{geocode_lat},{geocode_lon});
        nwr["man_made"="waste_transfer_station"](around:5000,{geocode_lat},{geocode_lon});
        nwr["amenity"="recycling"](around:5000,{geocode_lat},{geocode_lon});
    );
    out center;
    """
    
    try:
        response = requests.post(overpass_url, data=overpass_query)
        response.raise_for_status()
        data = response.json()
        
        # Process and categorize POIs without emission analysis
        all_pois = {}
        for element in data.get('elements', []):
            tags = element.get('tags', {})
            
            # Get coordinates
            if element['type'] == 'node':
                lat, lon = element.get('lat'), element.get('lon')
            else:
                center = element.get('center', {})
                lat, lon = center.get('lat'), center.get('lon')
            
            if lat and lon:
                # Determine category based on tags for emission sources
                category = None
                if 'industrial' in tags:
                    category = f"industrial_{tags['industrial']}"
                elif 'landuse' in tags and tags['landuse'] == 'industrial':
                    category = 'industrial_area'
                elif 'man_made' in tags and tags['man_made'] in ['works', 'chimney']:
                    category = f"industrial_{tags['man_made']}"
                elif 'power' in tags:
                    category = f"power_{tags['power']}"
                elif 'plant:source' in tags:
                    category = f"power_plant_{tags['plant:source']}"
                elif 'man_made' in tags and tags['man_made'] in ['oil_well', 'gas_well', 'storage_tank']:
                    category = f"fossil_fuel_{tags['man_made']}"
                elif 'landuse' in tags and tags['landuse'] in ['quarry', 'mine']:
                    category = f"extraction_{tags['landuse']}"
                elif 'aeroway' in tags:
                    category = f"transport_{tags['aeroway']}"
                elif 'railway' in tags and tags['railway'] == 'yard':
                    category = 'transport_railway_yard'
                # Inside get_pois_overpass function, in the categorization section:
                elif 'amenity' in tags and tags['amenity'] in ['bus_station', 'parking']:
                    category = f"transport_{tags['amenity']}"
                elif 'amenity' in tags and tags['amenity'] == 'fuel':
                    category = "transport_fuel"  # Specific category for fuel stations
                elif 'landuse' in tags and tags['landuse'] == 'landfill':
                    category = 'waste_landfill'
                elif 'man_made' in tags and tags['man_made'] in ['wastewater_plant', 'waste_transfer_station']:
                    category = f"waste_{tags['man_made']}"
                elif 'amenity' in tags and tags['amenity'] == 'recycling':
                    category = 'waste_recycling'
                
                if category:
                    if category not in all_pois:
                        all_pois[category] = []
                    
                    # Extract detailed information from tags
                    # Inside the poi_details creation in get_pois_overpass function
                    poi_details = {
                    'lat': lat,
                    'lon': lon,
                    'type': element['type'],
                    'id': element.get('id', ''),
                    'name': tags.get('name', ''),
                    'display_name': tags.get('name') or f"{category.replace('_', ' ').title()}",  # Add a display_name that's more user-friendly
                    'address': {
                    'street': tags.get('addr:street', ''),
                    'housenumber': tags.get('addr:housenumber', ''),
                    'city': tags.get('addr:city', ''),
                    'postcode': tags.get('addr:postcode', '')
                    },
                    'operator': tags.get('operator', ''),
                    'description': tags.get('description', ''),
                    'tags': tags
                    }
                    all_pois[category].append(poi_details)
    
    except Exception as e:
        print(f"Error fetching POIs: {str(e)}")
    
    return {
        "pois": all_pois,
        "geocode": {
            "lat": geocode_lat,
            "lon": geocode_lon,
            "display_name": geocode_data[0].get('display_name', '')
        },
        "bbox": bbox
    }



# Add this function at the module level, before it's called
def generate_boundary_geojson(area_name, city_name, bbox):
    """Generate a simple GeoJSON with just the boundary polygon from bbox."""
    # Create boundary polygon from bbox
    boundary_coords = [
        [bbox[0], bbox[1]],  # Southwest
        [bbox[0], bbox[3]],  # Northwest
        [bbox[2], bbox[3]],  # Northeast
        [bbox[2], bbox[1]],  # Southeast
        [bbox[0], bbox[1]]   # Close the polygon
    ]
    
    # Create the GeoJSON structure with just the boundary
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [boundary_coords]
                },
                "properties": {
                    "type": "boundary",
                    "name": f"{area_name}, {city_name}",
                    "strokeColor": "#0070f3",
                    "strokeWidth": 2
                }
            }
        ]
    }
    
    return geojson

# Then fix the create_basic_geojson function to remove the nested definition
def create_basic_geojson(bbox, area_name, city_name, pois_data):
    """Create a basic GeoJSON with boundary and POIs as fallback."""
    # Create boundary polygon from bbox
    boundary_coords = [
        [bbox[0], bbox[1]],  # Southwest
        [bbox[0], bbox[3]],  # Northwest
        [bbox[2], bbox[3]],  # Northeast
        [bbox[2], bbox[1]],  # Southeast
        [bbox[0], bbox[1]]   # Close the polygon
    ]
    
    # Create the GeoJSON structure
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [boundary_coords]
                },
                "properties": {
                    "type": "boundary",
                    "name": f"{area_name}, {city_name}",
                    "fillColor": "#0070f3",
                    "fillOpacity": 0.2,
                    "strokeColor": "#0070f3",
                    "strokeWidth": 2
                }
            }
        ]
    }
    
    # Define super categories for fallback
    super_categories = {
        "industrial": {"color": "#FF4136", "display_name": "Industrial & Manufacturing"},
        "power": {"color": "#FFDC00", "display_name": "Power Generation"},
        "fossil_fuel": {"color": "#0074D9", "display_name": "Fossil Fuel Extraction & Storage"},
        "fuel_station": {"color": "#FB8C00", "display_name": "Fuel Stations"},
        "transportation": {"color": "#2ECC40", "display_name": "Transportation & Vehicle Emissions"},
        "waste": {"color": "#B10DC9", "display_name": "Waste Processing & Landfills"},
        "other": {"color": "#111111", "display_name": "Other Emission Sources"}
    }
    
    # Add POI features
    colors = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF1919"]
    color_index = 0
    
    for category, pois in pois_data.items():
        color = colors[color_index % len(colors)]
        color_index += 1
        
        for poi in pois:
            if poi.get('lat') and poi.get('lon'):
                # Include emissions data in properties
                properties = {
                    "type": "poi",
                    "super_category": super_category,
                    "display_name": super_categories[super_category]["display_name"],
                    "category": category,
                    "name": poi.get('name') or category,
                    "color": super_categories[super_category]["color"],
                    "pollutants": emission["pollutants"],
                    "risk_level": emission["risk_level"],
                    "primary_concerns": emission.get("primary_concerns", []) if isinstance(emission.get("primary_concerns", []), list) else [],
                    "address": poi.get('address', {}),
                    "operator": poi.get('operator', ''),
                    "description": poi.get('description', ''),
                    "emissions": poi.get('emissions', {}),
                    "tags": poi.get('tags', {})
                }

                geojson["features"].append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [poi['lon'], poi['lat']]
                    },
                    "properties": properties
                })
    
    return geojson



# Update the emissions data processing in generate_pois_geojson function

def generate_pois_geojson(area_name, city_name, pois_data, bbox):
    """Generate a GeoJSON with emission source points and boundary."""
    geojson = {
        "type": "FeatureCollection",
        "features": []
    }
    
    # Define super categories based on what we collect from the Overpass query
    super_categories = {
        "industrial": {
            "color": "#FF4136",  # Red
            "display_name": "Industrial & Manufacturing",
            "patterns": ["industrial_", "landuse=industrial", "man_made=works", "man_made=chimney"]
        },
        "power": {
            "color": "#FFDC00",  # Yellow
            "display_name": "Power Generation",
            "patterns": ["power_"]
        },
        "fossil_fuel": {
            "color": "#0074D9",  # Blue
            "display_name": "Fossil Fuel Extraction & Storage",
            "patterns": ["fossil_fuel_", "extraction_"]
        },
        "fuel_station": {  # New category specifically for fuel stations
            "color": "#FB8C00",  # Orange color for fuel stations
            "display_name": "Fuel Stations",
            "patterns": ["transport_fuel"]
        },
        "transportation": {
            "color": "#2ECC40",  # Green
            "display_name": "Transportation & Vehicle Emissions",
            "patterns": ["transport_"]
        },
        "waste": {
            "color": "#B10DC9",  # Purple
            "display_name": "Waste Processing & Landfills",
            "patterns": ["waste_"]
        },
        "other": {
            "color": "#111111",  # Dark Gray
            "display_name": "Other Emission Sources",
            "patterns": []  # Catch-all for anything else
        }
    }
    
    # Prepare batch data for Gemini analysis
    batch_pois = []
    for category, pois in pois_data.items():
        for poi in pois:
            if poi.get('lat') and poi.get('lon'):
                batch_pois.append({
                    "category": category,
                    "name": poi.get('name', 'Unnamed POI'),
                    "lat": poi['lat'],
                    "lon": poi['lon'],
                    "tags": poi.get('tags', {})
                })
    
    # Process Gemini response with better error handling
    emissions_data = {}
    try:
        # Single Gemini call for all POIs
        analysis_prompt = f"""
        Analyze environmental impact for these {len(batch_pois)} points of interest in {area_name}, {city_name}.
        For each POI in this list: {json.dumps(batch_pois[:min(len(batch_pois), 20)], indent=2)}
        
        Return a JSON array where each element contains:
        - "lat": Original latitude
        - "lon": Original longitude  
        - "pollutants": Array of most likely pollutants that could be emitted analysing the category(no emission levels needed)
        
        Format example:
        [
            {{
                "lat": 40.7128,
                "lon": -74.0060,
                "pollutants": ["PM2.5", "NOx", "CO2"]
            }}
        ]
        """
        
        response = model.generate_content(analysis_prompt)
        
        # Print the raw response from Gemini
        
        json_str = response.text[response.text.find('['):response.text.rfind(']')+1]
        print("Extracted the JSON string")
        
        parsed_data = json.loads(json_str)

        
        # Convert the data to our expected format
        emissions_data = {}
        for item in parsed_data:
            key = f"{item['lat']},{item['lon']}"
            
            # Handle pollutants as either a set, list, or dictionary
            pollutants_list = []
            if isinstance(item.get('pollutants'), dict):
                # If it's a dictionary, extract the keys
                pollutants_list = list(item['pollutants'].keys())
            elif isinstance(item.get('pollutants'), list):
                # If it's already a list, use it directly
                pollutants_list = item['pollutants']
            else:
                # If it's something else (like a set in JSON), convert to list
                try:
                    pollutants_list = list(item.get('pollutants', []))
                except:
                    # Fallback to default pollutants based on category
                    for poi in batch_pois:
                        if abs(poi['lat'] - item['lat']) < 0.0001 and abs(poi['lon'] - item['lon']) < 0.0001:
                            pollutants_list = get_pollutants_by_category(poi['category'])
                            break
            
            emissions_data[key] = {
                "lat": item['lat'],
                "lon": item['lon'],
                "pollutants": pollutants_list
            }
            
        print(f"Successfully analyzed {len(emissions_data)} POIs with Gemini")
    except Exception as e:
        print(f"Gemini analysis error: {str(e)}")
        # Print the full exception traceback for debugging
        import traceback
        traceback.print_exc()
        
        # Generate fallback data with just pollutant names
        print("Generating fallback emissions data with pollutant names only")
        for poi in batch_pois:
            # Create basic emissions data based on category
            category = poi["category"]
            pollutants = get_pollutants_by_category(category)
            emissions_data[f"{poi['lat']},{poi['lon']}"] = {
                "lat": poi["lat"],
                "lon": poi["lon"],
                "pollutants": pollutants,  # List of pollutant names
            }
    
    # Create a dictionary to count POIs by super-category
    super_category_counts = {category: 0 for category in super_categories}
    
    # Process each POI with emissions data
    for category, pois in pois_data.items():
        for poi in pois:
            if poi.get('lat') and poi.get('lon'):
                # Determine super-category
                super_category = "other"  # Default
                for sc, sc_data in super_categories.items():
                    for pattern in sc_data["patterns"]:
                        if pattern in category.lower():
                            super_category = sc
                            break
                    if super_category != "other":
                        break
                
                # Increment count for this super-category
                super_category_counts[super_category] += 1
                
                # Get emissions data for this POI
                poi_key = f"{poi['lat']},{poi['lon']}"
                emission = emissions_data.get(poi_key, {
                    "pollutants": get_pollutants_by_category(category),

                })
                
                # Create properties for this POI
                properties = {
                    "type": "poi",
                    "super_category": super_category,
                    "display_name": super_categories[super_category]["display_name"],
                    "category": category,
                    "name": poi.get('name') or category,
                    "display_name": poi.get('display_name') or category.replace('_', ' ').title(),  # Use our new display_name
                    "color": super_categories[super_category]["color"],
                    "pollutants": emission.get("pollutants", []),
                    "address": poi.get('address', {}),
                    "operator": poi.get('operator', ''),
                    "description": poi.get('description', ''),
                    "tags": poi.get('tags', {})
                }
                
                # Add this POI to the GeoJSON
                geojson["features"].append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [poi['lon'], poi['lat']]
                    },
                    "properties": properties
                })
    
    # Create pie chart data from super-category counts
    pie_chart_data = []
    for sc, count in super_category_counts.items():
        if count > 0:  # Only include categories with POIs
            pie_chart_data.append({
                "name": super_categories[sc]["display_name"],
                "value": count,
                "color": super_categories[sc]["color"]
            })
    return geojson, super_categories, pie_chart_data


# Add these helper functions to get pollutants and concerns by category
def get_pollutants_by_category(category):
    """Get relevant pollutants based on POI category."""
    category = category.lower()
    
    if any(term in category for term in ["industrial", "factory", "works"]):
        return ["PM2.5", "NOx", "SO2"]
    elif any(term in category for term in ["power", "plant", "generator"]):
        return ["CO2", "NOx", "SO2"]
    elif any(term in category for term in ["oil", "gas", "petroleum", "mine", "quarry"]):
        return ["VOCs", "Methane", "Benzene"]
    elif any(term in category for term in ["waste", "landfill", "sewage"]):
        return ["Methane", "H2S", "VOCs"]
    elif any(term in category for term in ["transport", "bus", "railway", "aeroway", "fuel"]):
        return ["NOx", "PM10", "CO"]
    else:
        return ["CO2", "PM2.5"]  # Default pollutants

def get_concerns_by_category(category):
    """Get relevant environmental concerns based on POI category."""
    category = category.lower()
    
    if any(term in category for term in ["industrial", "factory", "works"]):
        return ["Air pollution", "Chemical exposure", "Soil contamination"]
    elif any(term in category for term in ["power", "plant", "generator"]):
        return ["Greenhouse gas emissions", "Air quality impact", "Resource depletion"]
    elif any(term in category for term in ["oil", "gas", "petroleum", "mine", "quarry"]):
        return ["Air toxics", "Groundwater contamination", "Soil pollution"]
    elif any(term in category for term in ["waste", "landfill", "sewage"]):
        return ["Odor issues", "Groundwater leaching", "Methane emissions"]
    elif any(term in category for term in ["transport", "bus", "railway", "aeroway", "fuel"]):
        return ["Air pollution", "Noise pollution", "Fuel consumption"]
    else:
        return ["Environmental impact", "Resource consumption", "Waste generation"]

# Add this import at the top
from datetime import datetime

# Add this function after your existing imports
def get_air_quality(lat, lon):
    """Fetch air quality data from OpenWeather API"""
    api_key = "c78cdd1106f1ecf72471c8b2e9010421"
    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={api_key}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if 'list' in data and len(data['list']) > 0:
            current_data = data['list'][0]
            return {
                'aqi': current_data['main']['aqi'],
                'components': current_data['components'],
                'dt': datetime.fromtimestamp(current_data['dt']).isoformat()
            }
        else:
            return {
                'aqi': 0,
                'components': {},
                'dt': datetime.now().isoformat(),
                'error': 'No air quality data available'
            }
            
    except requests.RequestException as e:
        print(f"Error fetching air quality data: {str(e)}")
        return {
            'aqi': 0,
            'components': {},
            'dt': datetime.now().isoformat(),
            'error': f'Failed to fetch air quality data: {str(e)}'
        }
    except Exception as e:
        print(f"Unexpected error in air quality fetch: {str(e)}")
        return {
            'aqi': 0,
            'components': {},
            'dt': datetime.now().isoformat(),
            'error': f'Unexpected error: {str(e)}'
        }

# Modify the analyze_area function to include air quality data

# Add this function after the get_air_quality function
def get_weather_data(lat, lon):
    """Fetch current weather data from OpenWeather API"""
    api_key = "c78cdd1106f1ecf72471c8b2e9010421"
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={api_key}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        return {
            'temp': data['main']['temp'],
            'feels_like': data['main']['feels_like'],
            'humidity': data['main']['humidity'],
            'wind_speed': data['wind']['speed'],
            'description': data['weather'][0]['description'],
            'icon': data['weather'][0]['icon'],
            'city': data['name'],
            'dt': datetime.fromtimestamp(data['dt']).isoformat(),
            'pressure': data['main']['pressure'],
            'visibility': data.get('visibility', 0)
        }
            
    except requests.RequestException as e:
        print(f"Error fetching weather data: {str(e)}")
        return {
            'error': f'Failed to fetch weather data: {str(e)}'
        }
    except Exception as e:
        print(f"Unexpected error in weather fetch: {str(e)}")
        return {
            'error': f'Unexpected error: {str(e)}'
        }

# Modify the analyze_area function to include weather data
# Add a reverse geocoding function to get location name from coordinates
def reverse_geocode(lat, lon):
    """Get location name from coordinates using Nominatim API"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&zoom=10"
        response = requests.get(url, headers={'User-Agent': 'EnviMap/1.0'})
        response.raise_for_status()
        data = response.json()
        
        # Extract address components
        address = data.get('address', {})
        city = address.get('city') or address.get('town') or address.get('village') or address.get('county') or ''
        area = address.get('suburb') or address.get('neighbourhood') or address.get('district') or address.get('state') or ''
        
        # If we couldn't get a specific area, use the display name
        if not area:
            area = data.get('display_name', '').split(',')[0]
        
        return {
            'city': city,
            'area': area,
            'display_name': data.get('display_name', '')
        }
    except Exception as e:
        print(f"Reverse geocoding error: {str(e)}")
        return {
            'city': 'Unknown City',
            'area': 'Unknown Area',
            'display_name': 'Unknown Location'
        }

def generate_health_recommendations(location, air_quality, weather):
    """Generate health recommendations using LLM based on environmental data."""
    pm25_level = air_quality['components'].get('pm2_5', 0)
    cigarettes_per_day = pm25_level / 22

    # Simplified and more structured prompt
    llm_prompt = f"""
    Generate health recommendations based on:
    Location: {location['display_name']}
    AQI: {air_quality['aqi']}
    PM2.5: {pm25_level} μg/m³
    Weather: {weather['description']}

    Return a JSON object with the following structure:
    {{
        "conditions": {{
            "Asthma": {{
                "risk_level": "Low/Medium/High",
                "do": ["action1", "action2,..."],
                "dont": ["action1", "action2,..."]
            }},
            "Heart_Issues": {{
                "risk_level": "Low/Medium/High",
                "do": ["action1", "action2,..."],
                "dont": ["action1", "action2,..."]
            }},
            "Allergies": {{
                "risk_level": "Low/Medium/High",
                "do": ["action1", "action2,..."],
                "dont": ["action1", "action2,..."]
            }},
            "Sinus": {{
                "risk_level": "Low/Medium/High",
                "do": ["action1", "action2,..."],
                "dont": ["action1", "action2,..."]
            }},
            "Cold_Flu": {{
                "risk_level": "Low/Medium/High",
                "do": ["action1", "action2,..."],
                "dont": ["action1", "action2,..."]
            }},
            "COPD": {{
                "risk_level": "Low/Medium/High",
                "do": ["action1", "action2,..."],
                "dont": ["action1", "action2,..."]
            }}
        }}
    }}

    Respond only with the JSON object, no additional text.
    """

    response = model.generate_content(llm_prompt)
    raw_response = response.text.strip()
        
        # Find the JSON object in the response
    json_start = raw_response.find('{')
    json_end = raw_response.rfind('}') + 1
    if json_start != -1 and json_end != -1:
        json_str = raw_response[json_start:json_end]
        health_recommendations = json.loads(json_str)
    else:
        raise ValueError("No valid JSON found in response")

    

    return {
        "location": location['display_name'],
        "cigarettes_per_day": round(cigarettes_per_day, 1),
        "air_quality": air_quality,
        "weather": weather,
        "recommendations": health_recommendations
    }

@app.post("/analyze-area")
async def analyze_area(area_request: dict):
    # Get coordinates from request
    latitude = area_request.get('latitude')
    longitude = area_request.get('longitude')
    
    # Use reverse geocoding to get location name
    if latitude and longitude:
        location_info = reverse_geocode(latitude, longitude)
        city_name = location_info['city']
        area_name = location_info['area']
    else:
        city_name = area_request.get('city')
        area_name = area_request.get('area')
    
    full_area_name = f"{area_name}, {city_name}"

    print(f"\n=== Starting Analysis for: {full_area_name} ===")

    poi_categories = [
        "school", "hospital", "pharmacy", "supermarket", "grocery",
        "restaurant", "cafe", "bar", "pub", "bus_stop", "train_station",
        "park", "playground", "bank", "atm", "post_office"
    ]

    try:
        # Get POIs from Overpass API
        print("\n[1/3] Getting POIs from Overpass...")
        overpass_pois_data = get_pois_overpass(area_name, city_name, poi_categories)

        if "error" in overpass_pois_data:
            print(f"Error fetching POIs from Overpass: {overpass_pois_data['error']}")
            raise HTTPException(status_code=500, detail=overpass_pois_data['error'])

        categorized_pois = overpass_pois_data['pois']
        geocode = overpass_pois_data['geocode']
        bbox = overpass_pois_data.get('bbox')
        
        print(f"Total POIs after combining: {sum(len(pois) for pois in categorized_pois.values())}")
        
        # Generate GeoJSON with POIs and boundary
        print("\n[3/3] Generating POIs GeoJSON...")
        pois_geojson, super_categories, pie_chart_data = generate_pois_geojson(area_name, city_name, categorized_pois, bbox)
        
        # Updated analysis prompt for emission sources analysis for EHSO
        analysis_prompt = f"""
        imagine you are an environmental health expert.
        Analyze the environmental impact for {area_name}, {city_name} and provide a structured assessment.
        Based on the POIs: {json.dumps(categorized_pois, indent=2)}

        Return a JSON with:
        - "category": One word status (Good/Moderate/Poor/Severe/Critical)
        - "summary": Concise analysis of environmental profile (4-5 sentences)
        - "ai_rating": Numerical score 0-100
        - "key_factors": Array of 3-4 main factors affecting the area's environmental health
        - "risks": Array of potential environmental risks, each with:
            - "level": (Low/Medium/High)
            - "description": Brief description 
        -"Key_Insights": Array of 3-4 key insights, each with:
            - "description": Brief description of the insight and it should be more focused on the overall air quality impact of the area.
            - "impact": (Low/Medium/High)


        IMPORTANT: Return only the raw JSON.
        """

        # Get analysis
        try:
            response = model.generate_content(analysis_prompt)
            
            # Extract JSON from the response
            json_start = response.text.find('{')
            json_end = response.text.rfind('}') + 1
            if json_start == -1 or json_end == -1:
                raise ValueError("No JSON found in the response")
                
            json_str = response.text[json_start:json_end]
            analysis_results = json.loads(json_str)
            
            # Get air quality and weather data
            air_quality_data = get_air_quality(geocode['lat'], geocode['lon'])
            weather_data = get_weather_data(geocode['lat'], geocode['lon'])
            
            # Generate health card data
            health_card_data = generate_health_recommendations(location_info, air_quality_data, weather_data)
            
            # Include all environmental impact analysis data in final_results
            final_results = {
                "summary": analysis_results.get("summary", ""),
                "pie_chart_data": pie_chart_data,
                "ai_rating": analysis_results.get("ai_rating", 0),
                "geocode": geocode,
                "bbox": bbox,
                "geojson": pois_geojson,
                "pois": categorized_pois,
                "air_quality": {
                    **air_quality_data,
                    "location": {
                        "city": city_name,
                        "area": area_name
                    }
                },
                "weather": weather_data,
                "health_card": health_card_data,  # Add health card data here
                # Include the complete environmental impact analysis
                "environmental_impact": {
                    "category": analysis_results.get("category", ""),
                    "summary": analysis_results.get("summary", ""),
                    "ai_rating": analysis_results.get("ai_rating", 0),
                    "key_factors": analysis_results.get("key_factors", []),
                    "risks": analysis_results.get("risks", []),
                    # Process insights to ensure they have the expected structure
                    "insights": [
                        {"description": insight if isinstance(insight, str) else insight.get("description", str(insight)),
                         "impact": insight.get("impact", "Medium") if isinstance(insight, dict) else "Medium"}
                        for insight in analysis_results.get("Key Insights", analysis_results.get("key_insights", analysis_results.get("insights", [])))
                    ]
                }
            }
            print("Final Results:", final_results)  # Log the final results
            return final_results
            
        except Exception as e:
            print(f"LLM API Error: {str(e)}")
            raise HTTPException(status_code=502, detail=f"LLM API Error: {str(e)}")
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
'''HERE CHECKPOINT WORKING

uvicorn main:app --reload
npm start

'''


