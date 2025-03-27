import React, { useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import AirQualityCard from './AirQualityCard';
import WeatherCard from './WeatherCard';
import './ScrollableCards.css';

const ScrollableCards = ({ analysis, city, area, handleNewAnalysis }) => {
  const scrollContainerRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);

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

  if (!analysis) return null;

  return (
    <div className="scrollable-container" ref={scrollContainerRef}>
      {/* Search overlay */}
      <div className="search-overlay">
        <button onClick={handleNewAnalysis} className="primary-button">
          Analyze New Area
        </button>
      </div>

      {/* First card with peek effect */}
      <div className="card peek-card">
        <div className="peek-indicator"></div>
        <div className="scroll-prompt">👇🏻 Hover HERE & Scroll to see full analysis 📬</div>
        <div className="analysis-scroll">
          <div className="analysis-scroll-content">
          </div>
        </div>
      </div>

      {/* Air Quality Card */}
      <div className="card dual-card">
        <div className="air-quality-section">
          {analysis.air_quality && (
            <AirQualityCard
              airQuality={analysis.air_quality}
              location={analysis.air_quality.location || { city, area }}
            />
          )}
        </div>
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

      {/* Analysis Card */}
      <div className="card analysis-card">
        <div className="analysis-header">
          <h3>Environmental Impact Analysis</h3>
        </div>
        <div className="analysis-content">
          <div className="score-container">
            <h2 className="score">{analysis?.ai_rating || "0"}/100</h2>
            <p className="score-label">Environmental Impact Rating</p>
          </div>

          <div className="score-bar">
            {Array.from({ length: 20 }).map((_, index) => (
              <div
                key={index}
                className={`score-segment ${index < (analysis?.ai_rating || 0) / 5 ? 'active' : ''}`}
                style={{
                  backgroundColor: index < (analysis?.ai_rating || 0) / 5
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

          {analysis?.insights && (
            <div className="insights-section">
              <h4>Key Insights</h4>
              <ul className="insights-list">
                {analysis.insights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis?.recommendations && (
            <div className="recommendations-section">
              <h4>Recommendations</h4>
              <ul className="recommendations-list">
                {analysis.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Add some bottom padding */}
      <div style={{ height: '50px' }}></div>
    </div>
  );
};

export default ScrollableCards;