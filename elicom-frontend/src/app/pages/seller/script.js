document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. Main Sales Line Chart (Canvas) ---
    const ctxSales = document.getElementById('salesChart').getContext('2d');
    
    // Professional Gradient Fill
    let saleGradient = ctxSales.createLinearGradient(0, 0, 0, 300);
    saleGradient.addColorStop(0, 'rgba(79, 70, 229, 0.25)'); // Indigo start
    saleGradient.addColorStop(1, 'rgba(79, 70, 229, 0.01)'); // Transparent end

    new Chart(ctxSales, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Revenue ($)',
                data: [1500, 2100, 1800, 3200, 2600, 3800, 4500],
                borderColor: '#4F46E5', // Brand Primary Color
                backgroundColor: saleGradient,
                borderWidth: 3,
                pointRadius: 0, // Clean line (no dots until hover)
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#4F46E5',
                fill: true,
                tension: 0.4 // Smooth professional curve
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A1F36',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: { label: (context) => `$${context.raw}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [6, 6], color: '#E0E7FF', drawBorder: false },
                    ticks: { color: '#A0AEC0', font: { size: 11, family: 'Inter' }, callback: (value) => '$' + value / 1000 + 'k' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#A0AEC0', font: { size: 11, family: 'Inter' } }
                }
            }
        }
    });

    // --- 2. Category Doughnut Chart (Canvas) ---
    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: ['Electronics', 'Accessories'],
            datasets: [{
                data: [65, 35],
                backgroundColor: ['#4F46E5', '#0ea5e9'], // Professional Blue & Sky Blue
                borderWidth: 0,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Thin professional ring
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    });
});