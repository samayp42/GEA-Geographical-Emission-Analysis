import React from 'react';
import './WeatherCard.css';

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

const WeatherCard = ({ weatherData }) => {
  if (!weatherData || weatherData.error) return null;

  const capitalizeDescription = (desc) => {
    return desc.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getTemperatureClass = (temp) => {
    if (temp <= 0) return 'very-cold';
    if (temp <= 10) return 'cold';
    if (temp <= 20) return 'mild';
    if (temp <= 30) return 'warm';
    return 'hot';
  };

  const tempClass = getTemperatureClass(weatherData.temp);

  return (
    <div className={`weather-card-map ${tempClass}`}>
      <div className="weather-background"></div>
      <div className="weather-content">
        <div className="weather-main-info">
          <div className="weather-icon-wrapper">
            <img 
              src={`https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`}
              alt={weatherData.description}
              className="weather-icon"
            />
          </div>
          <div className="temp-display">
            <span className="temp-value">{Math.round(weatherData.temp)}°C</span>
            <span className="weather-description">
              {capitalizeDescription(weatherData.description)}
            </span>
          </div>
        </div>
        
        <div className="weather-stats">
          <div className="weather-stat">
            <span className="stat-label">Feels Like: </span>
            <span className="stat-value">{Math.round(weatherData.feels_like)}°C</span>
          </div>
          <div className="weather-stat">
            <span className="stat-label">Humidity: </span>
            <span className="stat-value">{weatherData.humidity}%</span>
          </div>
          <div className="weather-stat">
            <span className="stat-label">Wind: </span>
            <span className="stat-value">{weatherData.wind_speed} m/s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherCard;