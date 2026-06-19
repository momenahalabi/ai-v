// Header scroll effect
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 50);
});

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

menuToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  menuToggle.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle.classList.remove('active');
  });
});

// Scroll reveal animation
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, index * 100);
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// FAQ accordion
document.querySelectorAll('.faq-item').forEach(item => {
  const question = item.querySelector('.faq-question');
  question.addEventListener('click', () => {
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
    if (!isActive) {
      item.classList.add('active');
    }
  });
});

// Contact form removed — CTAs open WhatsApp directly

// Smooth active nav link on scroll
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navItems.forEach(item => {
    item.style.color = '';
    if (item.getAttribute('href') === `#${current}`) {
      item.style.color = 'var(--text-primary)';
    }
  });
});

// Animate chart bars on scroll
const chartBars = document.querySelector('.chart-bars');
if (chartBars) {
  const chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.bar').forEach((bar, i) => {
          const height = bar.style.getPropertyValue('--h');
          bar.style.height = '0';
          setTimeout(() => {
            bar.style.height = height;
          }, i * 150);
        });
        chartObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  chartObserver.observe(chartBars);
}

// Intro video: ensure autoplay (muted) and attempt JS play as fallback
document.addEventListener('DOMContentLoaded', () => {
  const introIframe = document.getElementById('introVideoIframe');
  if (!introIframe) return;

  try {
    // Ensure query params
    const url = new URL(introIframe.src);
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('mute', '1');
    url.searchParams.set('playsinline', '1');
    url.searchParams.set('enablejsapi', '1');
    introIframe.src = url.toString();
  } catch (e) {}

  function sendPlayCommand() {
    try {
      introIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":[]}', '*');
    } catch (e) {}
  }

  // Try immediately and shortly after
  sendPlayCommand();
  setTimeout(sendPlayCommand, 400);

  // On first user interaction, unmute and continue playing
  const unmuteOnInteraction = () => {
    try {
      introIframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":[]}', '*');
      introIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":[]}', '*');
    } catch (e) {}
    window.removeEventListener('click', unmuteOnInteraction);
    window.removeEventListener('touchstart', unmuteOnInteraction);
  };

  window.addEventListener('click', unmuteOnInteraction, { once: true });
  window.addEventListener('touchstart', unmuteOnInteraction, { once: true });
});
