export const salesForecasting = (salesData) => {
    if (salesData.length < 7) return null;
  
    // Simple linear regression for forecasting
    const x = salesData.map((_, i) => i);
    const y = salesData.map(s => s.revenue);
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Forecast next 7 days
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const day = n + i;
      const predicted = slope * day + intercept;
      forecast.push({
        day: day + 1,
        predictedRevenue: Math.max(0, predicted),
      });
    }
    
    return {
      forecast,
      trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'stable',
      confidence: Math.min(Math.abs(slope) * 100, 95), // Simple confidence score
    };
  };
  
  export const demandPrediction = (productSales, productStock, days = 30) => {
    if (!productSales.length) return null;
  
    const avgDailySales = productSales.reduce((sum, sale) => sum + sale.quantity, 0) / days;
    const daysOfStock = productStock / avgDailySales;
    
    let prediction = 'stable';
    let urgency = 'low';
    
    if (daysOfStock < 7) {
      prediction = 'restock-urgent';
      urgency = 'high';
    } else if (daysOfStock < 14) {
      prediction = 'restock-soon';
      urgency = 'medium';
    } else if (daysOfStock > 60) {
      prediction = 'overstock';
      urgency = 'medium';
    }
    
    return {
      prediction,
      urgency,
      daysOfStock: Math.round(daysOfStock),
      avgDailySales: Math.round(avgDailySales * 10) / 10,
      recommendedOrder: Math.max(0, Math.round(avgDailySales * 14 - productStock)), // 2 weeks supply
    };
  };
  
  export const anomalyDetection = (salesData) => {
    if (salesData.length < 10) return [];
  
    const revenues = salesData.map(d => d.revenue);
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const stdDev = Math.sqrt(
      revenues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / revenues.length
    );
  
    const anomalies = salesData.filter((day, index) => {
      const zScore = Math.abs((day.revenue - mean) / stdDev);
      return zScore > 2.5; // 99% confidence interval
    });
  
    return anomalies.map(anomaly => ({
      date: anomaly.date,
      revenue: anomaly.revenue,
      deviation: ((anomaly.revenue - mean) / mean) * 100,
      type: anomaly.revenue > mean ? 'spike' : 'drop',
    }));
  };