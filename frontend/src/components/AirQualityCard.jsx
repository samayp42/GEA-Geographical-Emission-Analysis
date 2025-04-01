import React from "react";
import './AirQualityCard.css';

const getAQILevel = (aqi) => {
  if (aqi <= 50) return { text: "Good", color: "#4CAF50" }
  if (aqi <= 100) return { text: "Fair", color: "#FFC107" }
  if (aqi <= 150) return { text: "Moderate", color: "#FF9800" }
  if (aqi <= 200) return { text: "Poor", color: "#F44336" }
  if (aqi <= 300) return { text: "Very Poor", color: "#B71C1C" }
  return { text: "Hazardous", color: "#7B1FA2" }
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
    day: "numeric",
    month: "short",
  })
}

const getUnitAndTimeframe = (pollutant) => {
  switch (pollutant) {
    case 'o3': return { unit: 'ppb', timeframe: '8-hr' }
    case 'pm2_5': return { unit: 'μg/m³', timeframe: '24-hr' }
    case 'pm10': return { unit: 'μg/m³', timeframe: '24-hr' }
    case 'co': return { unit: 'ppm', timeframe: '8-hr' }
    case 'so2': return { unit: 'ppb', timeframe: '' }
    case 'no2': return { unit: 'ppb', timeframe: '1-hr' }
    default: return { unit: 'μg/m³', timeframe: '' }
  }
}

const formatPollutantName = (key) => {
  switch (key) {
    case 'pm2_5': return 'PM₂.₅'
    case 'pm10': return 'PM₁₀'
    case 'o3': return 'O₃'
    case 'no2': return 'NO₂'
    case 'so2': return 'SO₂'
    case 'co': return 'CO'
    default: return key.toUpperCase()
  }
}

const calculateAQI = (components) => {
  const breakpoints = {
    pm2_5: [0, 12, 35.4, 55.4, 150.4, 250.4, 500],
    pm10: [0, 54, 154, 254, 354, 424, 604],
    o3: [0, 54, 70, 85, 105, 200, 404],
    no2: [0, 53, 100, 360, 649, 1249, 2049],
    so2: [0, 35, 75, 185, 304, 604, 1004],
    co: [0, 4.4, 9.4, 12.4, 15.4, 30.4, 50.4],
  }

  const aqiScale = [0, 25, 50, 75, 100, 125, 150]

  let overallAQI = 0

  Object.keys(components).forEach((pollutant) => {
    if (!breakpoints[pollutant]) return
    const value = components[pollutant]
    const bp = breakpoints[pollutant]

    for (let i = 0; i < bp.length - 1; i++) {
      if (value >= bp[i] && value <= bp[i + 1]) {
        const aqi = ((aqiScale[i + 1] - aqiScale[i]) / (bp[i + 1] - bp[i])) * (value - bp[i]) + aqiScale[i]
        overallAQI = Math.max(overallAQI, Math.round(aqi))
        break
      }
    }
  })

  return overallAQI || 0
}

const AirQualityCard = ({ airQuality, location }) => {
  if (!airQuality) return null;

  const calculatedAQI = calculateAQI(airQuality.components);
  const aqiLevel = getAQILevel(calculatedAQI);
  const components = airQuality.components;

  // Dynamic background style based on AQI level
  const cardStyle = {
    background: `linear-gradient(135deg, ${aqiLevel.color}CC, ${aqiLevel.color}80)`,
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.18)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  };

  return (
    <div className="air-quality-card" style={cardStyle}>
      <div className="card-content">
        <div className="location-info">
          <h2>📍 {location.area}, {location.city}</h2>
          <p className="timestamp">Last Updated: {formatDate(airQuality.dt)}</p>
        </div>

        <div className="aqi-main">
          <div className="aqi-header">
            <h3>AIR QUALITY INDEX</h3>
          </div>
          <div className="aqi-value">
            <div className="aqi-display">
              <span className="aqi-number" style={{ color: aqiLevel.color }}>
                {calculatedAQI}
              </span>
              <div className="aqi-text-container">
                <span className="aqi-text" style={{ backgroundColor: aqiLevel.color }}>
                  {aqiLevel.text}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pollutants-grid">
          {Object.entries(components).map(([key, value]) => {
            const { unit } = getUnitAndTimeframe(key);
            return (
              <div key={key} className="pollutant-item">
                <div className="pollutant-details">
                  <span className="pollutant-name">{formatPollutantName(key)}</span>
                  <span className="pollutant-value">{value.toFixed(2)} <span className="unit">{unit}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AirQualityCard;
