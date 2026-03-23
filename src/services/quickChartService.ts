import type { BurndownChart } from '../models/burndownChart';
import dayjs from 'dayjs';

interface ChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  borderDash?: number[];
  fill: boolean;
  tension: number;
}

interface ChartConfig {
  type: string;
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options: {
    responsive: boolean;
    plugins: {
      title: { display: boolean; text: string; font: { size: number; weight: string } };
      legend: { display: boolean; position: string };
    };
    scales: {
      x: { title: { display: boolean; text: string }; grid: { display: boolean } };
      y: {
        title: { display: boolean; text: string };
        beginAtZero: boolean;
        max: number;
        grid: { display: boolean };
      };
    };
    elements: { point: { radius: number; hoverRadius: number } };
  };
}

interface ChartData {
  labels: string[];
  idealData: number[];
  actualData: (number | null)[];
}

export class QuickChartService {
  private readonly baseUrl = 'https://quickchart.io/chart';

  generateBurndownChartUrl(chart: BurndownChart, includeWeekends: boolean = false): string {
    const chartConfig = this.buildChartConfig(chart, includeWeekends);
    const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
    return `${this.baseUrl}?c=${encodedConfig}&width=600&height=400`;
  }

  private buildChartConfig(chart: BurndownChart, includeWeekends: boolean = false): ChartConfig {
    const { labels, idealData, actualData } = this.prepareChartData(chart, includeWeekends);

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
            tension: 0,
          },
          {
            label: 'Actual Burndown',
            data: actualData,
            borderColor: '#4ECDC4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: chart.title,
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date',
            },
            grid: {
              display: true,
            },
          },
          y: {
            title: {
              display: true,
              text: 'Story Points Remaining',
            },
            beginAtZero: true,
            max: chart.totalPoints,
            grid: {
              display: true,
            },
          },
        },
        elements: {
          point: {
            radius: 4,
            hoverRadius: 6,
          },
        },
      },
    };
  }

  private prepareChartData(chart: BurndownChart, includeWeekends: boolean = false): ChartData {
    const startDate = dayjs(chart.startDate);
    const endDate = dayjs(chart.endDate);
    const totalDays = endDate.diff(startDate, 'day');

    const labels: string[] = [];
    const workingDayIndices: number[] = [];

    for (let i = 0; i <= totalDays; i++) {
      const currentDate = startDate.add(i, 'day');
      const dayOfWeek = currentDate.day(); // 0 = Sunday, 6 = Saturday

      if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        labels.push(currentDate.format('MM/DD'));
        workingDayIndices.push(i);
      }
    }

    const idealData: number[] = [];
    const workingDaysCount = labels.length - 1;

    for (let i = 0; i < labels.length; i++) {
      if (workingDaysCount === 0) {
        idealData.push(chart.totalPoints);
      } else {
        const remainingPoints = chart.totalPoints * (1 - i / workingDaysCount);
        idealData.push(Math.round(remainingPoints * 100) / 100);
      }
    }

    const actualData: (number | null)[] = [];

    for (let i = 0; i < labels.length; i++) {
      actualData[i] = null;
    }

    actualData[0] = chart.totalPoints;

    const dayIndexToWorkingIndex = new Map(workingDayIndices.map((dayIdx, i) => [dayIdx, i]));

    chart.progressEntries.forEach((entry) => {
      const entryDate = dayjs(entry.date);
      const dayIndex = entryDate.diff(startDate, 'day');
      const workingDayIndex = dayIndexToWorkingIndex.get(dayIndex);
      if (workingDayIndex !== undefined) {
        actualData[workingDayIndex] = entry.pointsRemaining;
      }
    });

    if (chart.progressEntries.length > 0) {
      let lastKnownValue = chart.totalPoints;

      let lastDataIndex = 0;
      for (let i = 0; i < labels.length; i++) {
        if (actualData[i] !== null) {
          lastDataIndex = i;
        }
      }

      for (let i = 1; i < labels.length; i++) {
        if (actualData[i] !== null) {
          lastKnownValue = actualData[i] as number;
        } else if (i > lastDataIndex) {
          actualData[i] = null;
        } else {
          actualData[i] = lastKnownValue;
        }
      }
    }

    return { labels, idealData, actualData };
  }
}
