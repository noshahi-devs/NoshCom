document.addEventListener('DOMContentLoaded', function () {
    createParticles();
    setupSidebarToggle();
    setupDropdowns();
    updateDateTime();
    highlightActiveLink();
});

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    // Guard clause in case particles container is missing
    if (!particlesContainer) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random properties
        const size = Math.random() * 60 + 20;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const duration = Math.random() * 30 + 20;
        const delay = Math.random() * 10;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${x}vw`;
        particle.style.top = `${y}vh`;
        particle.style.opacity = Math.random() * 0.1 + 0.05;
        particle.style.animation = `float ${duration}s ${delay}s infinite linear`;

        particlesContainer.appendChild(particle);
    }
}

// Add CSS for float animation if not exists
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes float {
    0% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(10px, 10px) rotate(5deg); }
    50% { transform: translate(0, 20px) rotate(0deg); }
    75% { transform: translate(-10px, 10px) rotate(-5deg); }
    100% { transform: translate(0, 0) rotate(0deg); }
}`;
document.head.appendChild(styleSheet);


// Setup sidebar toggle
function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    const mainWrapper = document.getElementById('main-wrapper');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            topbar.classList.toggle('collapsed');
            mainWrapper.classList.toggle('collapsed');

            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show');
            } else {
                const isCollapsed = sidebar.classList.contains('collapsed');
                sidebar.style.width = isCollapsed ? '80px' : '280px';
                topbar.style.left = isCollapsed ? '80px' : '280px';
                mainWrapper.style.marginLeft = isCollapsed ? '80px' : '280px';
            }
        });
    }
}

// Setup dropdown menus
function setupDropdowns() {
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');

    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', function (e) {
            e.preventDefault();

            const navItem = this.closest('.nav-item');

            // Close all other dropdowns
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item !== navItem) {
                    item.classList.remove('expanded');
                }
            });

            // Toggle current dropdown
            navItem.classList.toggle('expanded');
        });
    });
}

function updateDateTime() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        dateElement.textContent = now.toLocaleDateString('en-US', options);
    }
}

function highlightActiveLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    // Remove active class from all links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');

        // Check if this link corresponds to current page
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');

            // If it's in a submenu, expand the parent
            const submenu = link.closest('.submenu');
            if (submenu) {
                const parentNavItem = submenu.closest('.nav-item');
                if (parentNavItem) {
                    parentNavItem.classList.add('expanded');
                }
            }
        }
    });
}
