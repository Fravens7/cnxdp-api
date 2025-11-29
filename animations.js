// animations.js

// 1. Inyectamos el estilo CSS del "Sweep" (Brillo) dinámicamente
const style = document.createElement('style');
style.innerHTML = `
  @keyframes sweepShine {
    0% { transform: translateX(-150%) skewX(-20deg); }
    100% { transform: translateX(150%) skewX(-20deg); }
  }
  
  .sweep-effect::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      to right, 
      rgba(255, 255, 255, 0) 0%, 
      rgba(255, 255, 255, 0.6) 50%, 
      rgba(255, 255, 255, 0) 100%
    );
    transform: translateX(-150%) skewX(-20deg);
    animation: sweepShine 0.8s ease-in-out;
    pointer-events: none;
  }
`;
document.head.appendChild(style);

export function iniciarAnimacionLogo(brandPalette) {
    const logo = document.getElementById('brand-logo');
    if (!logo) return;

    // Secuencia de marcas
    const sequence = [
        { text: 'BDT', color: '#161e4b' }, 
        { text: 'M1',  color: brandPalette['M1'].bg },
        { text: 'M2',  color: brandPalette['M2'].bg },
        { text: 'B1',  color: brandPalette['B1'].bg },
        { text: 'B2',  color: brandPalette['B2'].bg },
        { text: 'B3',  color: brandPalette['B3'].bg },
        { text: 'B4',  color: brandPalette['B4'].bg },
        { text: 'K1',  color: brandPalette['K1'].bg }
    ];

    let currentIndex = 0;

    setInterval(() => {
        // 1. Activamos el efecto de brillo (agregando la clase)
        logo.classList.remove('sweep-effect'); // Reset por si acaso
        void logo.offsetWidth; // Truco para reiniciar la animación CSS
        logo.classList.add('sweep-effect');

        // 2. Cambiamos el texto y color justo cuando el brillo pasa por el medio (a los 300ms)
        setTimeout(() => {
            currentIndex = (currentIndex + 1) % sequence.length;
            const item = sequence[currentIndex];
            
            logo.textContent = item.text;
            logo.style.backgroundColor = item.color;
        }, 300); // Sincronizado con el paso del brillo

    }, 4000); // Cada 4 segundos
}
