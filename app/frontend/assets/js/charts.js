const TBTCharts = {
  radar(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Your Score (%)',
          data,
          backgroundColor: 'rgba(30,58,95,0.15)',
          borderColor: '#1E3A5F',
          borderWidth: 2,
          pointBackgroundColor: '#F59E0B',
          pointBorderColor: '#fff',
          pointRadius: 5,
        }],
      },
      options: {
        responsive: true,
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
        plugins: { legend: { display: false } },
      },
    });
  },

  bar(canvasId, labels, data, label = 'Assessments') {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: '#1E3A5F',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });
  },

  doughnut(canvasId, labels, data) {
    const COLORS = ['#1E3A5F','#3B82F6','#8B5CF6','#F59E0B','#10B981','#EF4444','#EC4899','#06B6D4'];
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: COLORS.slice(0, data.length),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: { legend: { position: 'right' } },
      },
    });
  },
};
