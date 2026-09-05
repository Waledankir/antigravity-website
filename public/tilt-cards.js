/**
 * UNIS JOURNALISM - 3D TILT MATRIX & SPECULAR SHEEN ENGINE
 * Adds responsive, smooth 3D perspective physics to news cards
 */

class TiltCardEngine {
  constructor(selector = '.tilt-card') {
    this.selector = selector;
    this.cards = [];
    this.init();
  }

  init() {
    this.refresh();
  }

  refresh() {
    const elements = document.querySelectorAll(this.selector);
    elements.forEach(el => {
      if (!el.dataset.tiltInitialized) {
        this.bindCard(el);
      }
    });
  }

  bindCard(card) {
    card.dataset.tiltInitialized = "true";

    // Create specular sheen element if absent
    let sheen = card.querySelector('.tilt-sheen');
    if (!sheen) {
      sheen = document.createElement('div');
      sheen.className = 'tilt-sheen';
      card.prepend(sheen);
    }

    let bounds = null;
    let isHovered = false;

    const onMouseEnter = () => {
      bounds = card.getBoundingClientRect();
      isHovered = true;
    };

    const onMouseMove = (e) => {
      if (!isHovered || !bounds) bounds = card.getBoundingClientRect();

      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;

      const percentX = mouseX / bounds.width;
      const percentY = mouseY / bounds.height;

      // Calculate tilt angles (degrees)
      const maxTilt = 12;
      const tiltX = (0.5 - percentY) * (maxTilt * 2);
      const tiltY = (percentX - 0.5) * (maxTilt * 2);

      // Apply 3D perspective transformation
      card.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateZ(12px)`;

      // Dynamic specular reflection highlight
      sheen.style.background = `radial-gradient(circle at ${percentX * 100}% ${percentY * 100}%, rgba(255, 255, 255, 0.45) 0%, rgba(0, 245, 155, 0.15) 30%, transparent 65%)`;
    };

    const onMouseLeave = () => {
      isHovered = false;
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      sheen.style.background = 'transparent';
    };

    card.addEventListener('mouseenter', onMouseEnter);
    card.addEventListener('mousemove', onMouseMove);
    card.addEventListener('mouseleave', onMouseLeave);
  }
}

window.TiltCardEngine = TiltCardEngine;
