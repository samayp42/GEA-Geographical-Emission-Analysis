import React, { useState } from 'react';
import axios from 'axios';
import Mapview from './components/Mapview';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';
import AirQualityCard from './components/AirQualityCard';
// Add this import at the top
import WeatherCard from './components/WeatherCard';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];


// In your App component, add the AirQualityCard before the Mapview
function App() {
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // Colors for the pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/analyze-area`, {        city: city,
        area: area
      });
      console.log("Analysis response:", response.data);
      
      setAnalysis(response.data);
      setResults({
        pois: response.data.pois || {},
        geocode: response.data.geocode || {},
        bbox: response.data.bbox || null,
        boundary_polygon: response.data.boundary_polygon || null,
        geojson: response.data.geojson || null  // Add support for the new geojson field
      });
      setShowAnalysis(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.detail || 'An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setShowAnalysis(false);
  };

  // Remove the local calculateScore function since we'll get the score from the LLM

  return (
    <div className="app-container">
      <div className="sidebar">
        {!showAnalysis ? (
          // Input Panel
          <>
            <div className="app-title">
              <h1>GEA: Geospatial Emission Analysis 🏭</h1>
              <p>Identify and assess environmental emission sources in your area</p>
            </div>
            
            <div className="search-container">
              <div className="search-input">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter City..."
                />
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Enter Area..."
                />
                <button 
                  onClick={handleSearch} 
                  disabled={loading || !city || !area}
                  className="primary-button"
                >
                  {loading ? 'Analyzing...' : 'Analyze Area'}
                </button>
              </div>
              {error && <div className="error-message">{error}</div>}
            </div>
            
            <div className="instructions">
              <h3>Follow these steps:</h3>
              <ol>
                <li><span className="step-number">🏭</span> Enter a city name</li>
                <li><span className="step-number">🔍</span> Enter an area within that city</li>
                <li><span className="step-number">📊</span> Click "Analyze Area"</li>
                <li><span className="step-number">📝</span> Review the environmental impact analysis</li>
              </ol>
            </div>
          </>
        ) : (
          // Analysis Panel
          <div className="analysis-panel">
            <div className="analysis-panel-header">
              <h3>Environmental Emission Source Analysis</h3>
              <button onClick={handleNewAnalysis} className="secondary-button">
                Analyze New Area
              </button>
            </div>
            
            <WeatherCard weatherData={analysis.weather} />
            
            <div className="analysis-panel-content">
              <AirQualityCard 
                airQuality={analysis.air_quality}
                location={{ city, area }}
              />
              
              <div className="score-container">
                <h2 className="score">{analysis?.ai_rating || "0"}/100</h2>
                <p className="score-label">Environmental Impact Rating</p>
              </div>
              
              <div className="score-bar">
                {Array.from({ length: 20 }).map((_, index) => (
                  <div 
                    key={index} 
                    className={`score-segment ${index < (analysis?.ai_rating || 0)/5 ? 'active' : ''}`}
                    style={{ 
                      backgroundColor: index < (analysis?.ai_rating || 0)/5 
                        ? `hsl(${160 - index * 8}, 80%, ${50 + index * 1.5}%)` 
                        : '#e0e0e0' 
                    }}
                  />
                ))}
              </div>
              
              <div className="summary">
                <p>
                  {typeof analysis?.summary === 'object' 
                    ? JSON.stringify(analysis.summary) 
                    : analysis?.summary || "No summary available."}
                </p>
              </div>
              
              <div className="categories-section">
                <h4>Emission Source Distribution</h4>
                <div className="chart-container">
                  {analysis?.pie_chart_data && analysis.pie_chart_data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analysis.pie_chart_data.filter(item => item.value > 0)}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={30}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          labelLine={false}
                          label={({ name, percent }) => {
                            if (percent < 0.03) return null;
                            const displayName = typeof name === 'object' 
                              ? Object.keys(name)[0] 
                              : String(name);
                            return `${displayName}: ${(percent * 100).toFixed(0)}%`;
                          }}
                        >
                          {analysis.pie_chart_data
                            .filter(item => item.value > 0)
                            .map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name) => {
                            const displayName = typeof name === 'object' 
                              ? Object.keys(name)[0] 
                              : String(name);
                            return [`${value} Sources`, displayName];
                          }}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            padding: '10px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="no-data">No distribution data available.</p>
                  )}
                </div>
                
                <div className="categories-legend">
                  {analysis?.pie_chart_data && 
                    analysis.pie_chart_data
                      .filter(item => item.value > 0)
                      .map((category, index) => {
                        const displayName = typeof category.name === 'object' 
                          ? Object.keys(category.name)[0] 
                          : String(category.name);
                        return (
                          <div key={index} className="category-item">
                            <span 
                              className="category-color" 
                              style={{ backgroundColor: category.color || COLORS[index % COLORS.length] }}
                            />
                            <span className="category-name">{displayName}</span>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="main-content">
        <Mapview 
          results={results} 
          pieChartData={analysis?.pie_chart_data}
          colors={COLORS}
          weatherData={analysis?.weather}  // 
        />
      </div>
    </div>
  );
}

export default App;