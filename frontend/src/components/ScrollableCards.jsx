import React, { useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import AirQualityCard from './AirqualityCard';
import './ScrollableCards.css';
import { FaSun, FaMoon, FaCheck, FaTimes, FaLungs, FaHeartbeat, FaAllergies, FaVirus, FaWind } from 'react-icons/fa';
import { GiLungs } from 'react-icons/gi';
import { TbMoodSick } from 'react-icons/tb';

const ScrollableCards = ({ analysis, city, area, handleNewAnalysis }) => {
  const scrollContainerRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // Set light theme as default
  const [selectedCondition, setSelectedCondition] = useState(null); // Track selected health condition

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setIsScrolled(scrollContainerRef.current.scrollTop > 100);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [darkMode]);
  
  // Set the first condition as selected when data loads
  useEffect(() => {
    if (analysis?.health_card?.recommendations?.conditions) {
      const conditions = Object.keys(analysis.health_card.recommendations.conditions);
      if (conditions.length > 0 && !selectedCondition) {
        setSelectedCondition(conditions[0]);
      }
    }
  }, [analysis, selectedCondition]);
  
  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  if (!analysis) return null;

  return (
    <div className={`scrollable-container ${darkMode ? 'dark-theme' : 'light-theme'}`} ref={scrollContainerRef}>
      {/* Theme toggle button */}


      {/* Search overlay */}
      <div className="search-overlay">
        <button onClick={handleNewAnalysis} className="primary-button">
          Analyze New Area
        </button>
      </div>

      {/* First card with peek effect */}
      <div className="card peek-card">
        <div className="peek-indicator"></div>
        <div className="scroll-prompt">👇🏻 Hover HERE & Scroll to see full analysis </div>
        <div className="analysis-scroll">
          <div className="analysis-scroll-content">
          </div>
        </div>
      </div>

      {/* Air Quality Card */}
      <div className="air-quality-section">
        {analysis.air_quality && (
          <AirQualityCard
            airQuality={analysis.air_quality}
            location={analysis.air_quality.location || { city, area }}
          />
        )}
      </div>

      {/* Visualization Card */}
      <div className="card visualization-card">
        <div className="visualization-header">
          <h3>Emission Source Distribution</h3>
        </div>
        <div className="visualization-content">
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
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color || ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'][index % 6]} 
                        />
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
                  const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];
                  return (
                    <div key={index} className="category-item">
                      <span
                        className="category-color"
                        style={{ backgroundColor: category.color || colors[index % colors.length] }}
                      />
                      <span className="category-name">{displayName}</span>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Enhanced Environmental Impact Analysis Dashboard */}
      <div className="card analysis-card">
        <div className="analysis-header">
          <h3>Environmental Impact Analysis</h3>
          {analysis?.category && (
            <div className={`status-badge ${analysis.category ? analysis.category.toLowerCase() : 'unknown'}`}>
              {analysis.category}
            </div>
          )}
        </div>
        <div className="analysis-content">
          {/* Rating Gauge */}
          <div className="impact-rating-container">
            <div className="rating-info">
              <h2 className="rating-title">{analysis?.ai_rating || "0"}/100</h2>
              <p className="rating-description">
                Environmental Impact Rating
              </p>
            </div>
            
            <div className="rating-gauge">
              <div 
                className="gauge-fill" 
                style={{
                  width: `${analysis?.ai_rating || 0}%`,
                  background: `linear-gradient(90deg, 
                    hsl(140, 80%, 50%) 0%, 
                    hsl(${Math.max(140 - (analysis?.ai_rating || 0) * 1.4, 0)}, 80%, 50%) 100%)`
                }}
              ></div>
              <div 
                className="gauge-marker" 
                style={{ left: `${analysis?.ai_rating || 0}%` }}
              >
                <div className="gauge-value">{analysis?.ai_rating || "0"}</div>
              </div>
            </div>
            
            <div className="gauge-labels">
              <span>Excellent</span>
              <span>Good</span>
              <span>Fair</span>
              <span>Poor</span>
              <span>Critical</span>
            </div>
          </div>
          
          {/* Summary Section */}
          <div className="summary-container">
            <div className="summary-header">
              <div className="summary-icon">📝</div>
              <h4>Summary</h4>
            </div>
            <div className="summary-content">
              <p>
                {typeof analysis?.summary === 'object'
                  ? JSON.stringify(analysis.summary)
                  : analysis?.summary || "No summary available."}
              </p>
            </div>
          </div>
          
          {/* Environmental Risks Section */}
          <div className="risks-section">
            <h4>Potential Environmental Risks</h4>
            <div className="risks-list">
              {analysis?.environmental_impact?.risks && analysis.environmental_impact.risks.length > 0 ? (
                analysis.environmental_impact.risks.map((risk, index) => (
                  <div key={index} className={`risk-item ${risk.level ? risk.level.toLowerCase() : 'unknown'}`}>
                    <div className="risk-level-indicator">
                      <span className="risk-level">{risk.level}</span>
                    </div>
                    <div className="risk-description">
                      {risk.description}
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">No risk data available.</p>
              )}
            </div>
          </div>
          
          {/* Health Recommendations Card - Redesigned to match screenshot */}
          <div className="card health-recommendations-card">
            <div className="health-recommendations-header">
              <div className="health-icon-title">
                <span className="health-icon">🏥</span>
                <h3>Prevent Health Problems: Understand Your Risks</h3>
              </div>
              <div className="cigarettes-badge">
                <div className="cigarette-icon">
                  <img src={require('../assets/cough.png')} alt="Cigarette" className="cigarette-image" />
                  <img src={require('../assets/Clouds_animation.gif')} alt="Smoke" className="smoke-animation" />
                </div>
                <span>{analysis?.health_card?.cigarettes_per_day || 0} Cigarettes / Day</span>
              </div>
            </div>
            
            {/* Location name */}
            <div className="health-location">
              {analysis?.air_quality?.location?.city || city || 'Your Location'}
            </div>
            
            {/* Horizontal condition buttons */}
            {analysis?.health_card?.recommendations?.conditions && (
              <div className="health-condition-buttons">
                {Object.entries(analysis.health_card.recommendations.conditions).map(([condition, data], index) => {
                  const isSelected = selectedCondition === condition;
                  let icon;
                  switch(condition.toLowerCase()) {
                    case 'asthma':
                      icon = <FaLungs />;
                      break;
                    case 'heart issues':
                    case 'heart_issues':
                      icon = <FaHeartbeat />;
                      break;
                    case 'allergies':
                      icon = <FaAllergies />;
                      break;
                    case 'sinus':
                      icon = <FaWind />;
                      break;
                    case 'cold/flu':
                    case 'cold_flu':
                      icon = <FaVirus />;
                      break;
                    case 'chronic (copd)':
                    case 'chronic_copd':
                      icon = <GiLungs />;
                      break;
                    default:
                      icon = <TbMoodSick />;
                      break;
                  }
                  
                  return (
                    <button
                      key={index}
                      className={`condition-button ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedCondition(condition)}
                    >
                      <span className="condition-icon">{icon}</span>
                      <span className="condition-name">{condition.replace('_', ' ')}</span>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* Selected condition details */}
            {selectedCondition && analysis?.health_card?.recommendations?.conditions && (
              <div className="selected-condition-details">
                {(() => {
                  const data = analysis.health_card.recommendations.conditions[selectedCondition];
                  const riskLevel = data.risk_level ? data.risk_level.toLowerCase() : 'medium';
                  const displayName = selectedCondition.replace('_', ' ');
                  
                  // Show condition-specific images
                  const conditionImage = (
                    <div className="condition-illustration">
                      <img 
                        src={require(`../assets/images/${selectedCondition.toLowerCase().replace(/[\s()]/g, '')}.png`)} 
                        alt={displayName} 
                        style={{ width: '100%', height: 'auto', maxWidth: '200px' }} 
                      />
                    </div>
                  );
                  
                  return (
                    <div className="condition-detail-container">
                      <div className="condition-left-panel">
                        {conditionImage}
                        <div className="risk-indicator">
                          <div className={`risk-badge ${riskLevel}`}>
                            {riskLevel === 'mid' ? 'MID' : riskLevel.toUpperCase()} Chances of {displayName}
                          </div>
                        </div>
                      </div>
                      
                      <div className="condition-right-panel">
                        <div className="condition-header">
                          <h4>{displayName}</h4>
                          <div className={`risk-badge ${riskLevel}`}>{riskLevel.toUpperCase()}</div>
                        </div>
                        
                        <div className="condition-description">
                          <p>✎ Risk of {displayName} symptoms is <strong>{riskLevel}</strong> when AQI is {data.aqi_range || 'Moderate (50-150)'}.</p>
                          <p>{data.description || `🗒️ Moderate symptoms including frequent wheezing, noticeable shortness of breath, chest tightness, and persistent cough.`}</p>
                        </div>
                        
                        <div className="recommendations-columns">
                          <div className="do-column">
                            <div className="column-header">
                              <FaCheck className="check-icon" />
                              <span>Do's :</span>
                            </div>
                            <ul className="recommendation-list">
                              {data.do && data.do.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="dont-column">
                            <div className="column-header">
                              <FaTimes className="x-icon" />
                              <span>Dont's :</span>
                            </div>
                            <ul className="recommendation-list">
                              {data.dont && data.dont.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {!analysis?.health_card?.recommendations?.conditions && (
              <p className="no-data">No health recommendations available.</p>
            )}
          </div>
          
          {/* Key Insights section removed as requested */}
        </div>
      </div>

      {/* Add some bottom padding */}
      <div style={{ height: '50px' }}></div>
    </div>
  );
};

export default ScrollableCards;