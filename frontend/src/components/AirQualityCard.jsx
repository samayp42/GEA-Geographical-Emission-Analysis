import React from 'react';
import './AirQualityCard.css';

const getAQILevel = (aqi) => {
  switch(aqi) {
    case 1: return { text: 'Good', color: '#00C853' };
    case 2: return { text: 'Fair', color: '#FFD600' };
    case 3: return { text: 'Moderate', color: '#FF9100' };
    case 4: return { text: 'Poor', color: '#FF3D00' };
    case 5: return { text: 'Very Poor', color: '#D50000' };
    default: return { text: 'Unknown', color: '#757575' };
  }
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    day: 'numeric',
    month: 'short'
  });
};

const AirQualityCard = ({ airQuality, location }) => {
  if (!airQuality) return null;
  
  const aqiLevel = getAQILevel(airQuality.aqi);
  const components = airQuality.components;

  return (
    <div className="air-quality-card">
      <div className="location-info">
        <h2>{location.area}, {location.city}</h2>
        <p className="timestamp">Last Updated: {formatDate(airQuality.dt)}</p>
      </div>
      
      <div className="aqi-main">
        <div className="aqi-value" style={{ color: aqiLevel.color }}>
          <h3>Air Quality Index</h3>
          <div className="aqi-display">
            <span className="aqi-number">{airQuality.aqi}</span>
            <span className="aqi-text">{aqiLevel.text}</span>
          </div>
        </div>
      </div>

      <div className="pollutants-grid">
        {Object.entries(components).map(([key, value]) => (
          <div key={key} className="pollutant-item">
            <span className="pollutant-name">{key.toUpperCase()}</span>
            <span className="pollutant-value">{value.toFixed(2)} μg/m³</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirQualityCard;