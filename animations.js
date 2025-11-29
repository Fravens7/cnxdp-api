// animations.js

export function iniciarAnimacionLogo(brandPalette) {
    const logo = document.getElementById('brand-logo');
    if (!logo) return;

    // Secuencia: BDT -> M1 -> M2 -> B1 ... -> K1 -> (Repetir)
    const sequence = [
        { text: 'BDT', color: '#161e4b' }, // Estado base
        { text: 'M1',  color: brandPalette['M1'].bg },
        { text: 'M2',  color: brandPalette['M2'].bg },
        { text: 'B1',  color: brandPalette['B1'].bg },
        { text: 'B2',  color: brandPalette['B2'].bg },
        { text: 'B3',  color: brandPalette['B3'].bg },
        { text: 'B4',  color: brandPalette['B4'].bg },
        { text: 'K1',  color: brandPalette['K1'].bg }
    ];

    let currentIndex = 0;

    // Intervalo infinito cada 3.5 segundos
    setInterval(() => {
        // 1. FASE DE SALIDA: Giro 3D y encogimiento (Efecto "Flip")
        // Usamos estilos inline para controlar la transformación exacta
        logo.style.transform = 'perspective(400px) rotateX(90deg) scale(0.9)'; 
        logo.style.opacity = '0.8';

        setTimeout(() => {
            // 2. CAMBIO DE DATOS (Oculto)
            currentIndex = (currentIndex + 1) % sequence.length;
            const item = sequence[currentIndex];
            
            logo.textContent = item.text;
            logo.style.backgroundColor = item.color;
            
            // Un pequeño brillo sutil al cambiar (box-shadow)
            logo.style.boxShadow = `0 10px 15px -3px ${item.color}66`; // 66 es transparencia

            // 3. FASE DE ENTRADA: Regreso elástico
            logo.style.transform = 'perspective(400px) rotateX(0deg) scale(1)';
            logo.style.opacity = '1';
            
        }, 500); // Esperamos 0.5s (mitad de la transición CSS) para cambiar el texto

    }, 3500);
}
