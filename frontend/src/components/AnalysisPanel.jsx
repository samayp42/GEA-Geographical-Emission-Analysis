import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const AnalysisPanel = ({ analysisData }) => {
  if (!analysisData) return <div className="analysis-panel">No analysis data available</div>;

  const { summary, pie_chart_data, ai_rating, geocode } = analysisData;
  const locationName = geocode?.display_name || "Unknown Location";

  return (
    <div className="analysis-panel">
      <div className="location-header">
        <h2>{locationName}</h2>
        <div className="rating-badge">
          <span className="rating-value">{ai_rating}/100</span>
          <span className="rating-label">AI-Estimated Rating</span>
        </div>
      </div>

      <div className="summary-section">
        <h3>Area Analysis</h3>
        <p>{summary}</p>
      </div>

      {pie_chart_data && pie_chart_data.length > 0 && (
        <div className="chart-section">
          <h3>POI Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pie_chart_data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pie_chart_data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [`${value} locations`, name]}
                  labelFormatter={() => 'POI Category'}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            {pie_chart_data.map((entry, index) => (
              <div key={`legend-${index}`} className="legend-item">
                <div className="color-box" style={{ backgroundColor: entry.color }}></div>
                <span>{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;