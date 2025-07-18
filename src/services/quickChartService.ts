import { BurndownChart } from '../models/burndownChart';
import dayjs from 'dayjs';

export class QuickChartService {
  private readonly baseUrl = 'https://quickchart.io/chart';

  generateBurndownChartUrl(chart: BurndownChart): string {
    const chartConfig = this.buildChartConfig(chart);
    const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
    return `${this.baseUrl}?c=${encodedConfig}&width=600&height=400`;
  }

  private buildChartConfig(chart: BurndownChart) {
    const { labels, idealData, actualData } = this.prepareChartData(chart);

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ideal Burndown',
            data: idealData,
            borderColor: '#FF6B6B',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0
          },
          {
            label: 'Actual Burndown',
            data: actualData,
            borderColor: '#4ECDC4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: chart.title,
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            },
            grid: {
              display: true
            }
          },
          y: {
            title: {
              display: true,
              text: 'Story Points Remaining'
            },
            beginAtZero: true,
            max: chart.totalPoints,
            grid: {
              display: true
            }
          }
        },
        elements: {
          point: {
            radius: 4,
            hoverRadius: 6
          }
        }
      }
    };
  }

  private prepareChartData(chart: BurndownChart) {
    const startDate = dayjs(chart.startDate);
    const endDate = dayjs(chart.endDate);
    const totalDays = endDate.diff(startDate, 'day');

    // Generate labels for all days in the sprint
    const labels: string[] = [];
    for (let i = 0; i <= totalDays; i++) {
      labels.push(startDate.add(i, 'day').format('MM/DD'));
    }

    // Generate ideal burndown line (linear decrease from totalPoints to 0)
    const idealData: number[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const remainingPoints = chart.totalPoints - (chart.totalPoints * i / totalDays);
      idealData.push(Math.round(remainingPoints * 100) / 100);
    }

    // Generate actual burndown line based on progress entries
    const actualData: (number | null)[] = [];
    
    // Start with total points
    actualData[0] = chart.totalPoints;
    
    // Fill in the rest with null initially
    for (let i = 1; i <= totalDays; i++) {
      actualData[i] = null;
    }

    // Add actual progress data points
    chart.progressEntries.forEach(entry => {
      const entryDate = dayjs(entry.date);
      const dayIndex = entryDate.diff(startDate, 'day');
      if (dayIndex >= 0 && dayIndex <= totalDays) {
        actualData[dayIndex] = entry.pointsRemaining;
      }
    });

    // If we have progress entries, connect the line by filling gaps
    if (chart.progressEntries.length > 0) {
      let lastKnownValue = chart.totalPoints;
      for (let i = 1; i <= totalDays; i++) {
        if (actualData[i] !== null) {
          lastKnownValue = actualData[i] as number;
        } else {
          // Only show the line up to the last known data point
          const hasLaterData = actualData.slice(i + 1).some(val => val !== null);
          if (!hasLaterData) {
            break;
          }
        }
      }
    }

    return { labels, idealData, actualData };
  }
}