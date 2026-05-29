import React, { useEffect, useRef } from 'react';

const Particles = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    const getParticleCount = () => (window.innerWidth < 768 ? 36 : 80);

    // Resize Handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const nextCount = getParticleCount();
      if (particles.length > nextCount) {
        particles = particles.slice(0, nextCount);
      }
      while (particles.length < nextCount) {
        particles.push(new Particle());
      }
    };
    // Mouse Movement Tracking
    const handleMouseMove = (e) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (hasFinePointer) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Particle Class
    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(init = false) {
        this.x = Math.random() * canvas.width;
        this.y = init ? Math.random() * canvas.height : canvas.height + 10;
        this.radius = Math.random() * 2 + 0.5;
        // Alternate colors between Gold, Rose Gold, and Burgundy glow
        const rand = Math.random();
        if (rand < 0.4) {
          this.color = { r: 212, g: 175, b: 55 }; // Gold
        } else if (rand < 0.8) {
          this.color = { r: 183, g: 110, b: 121 }; // Rose Gold
        } else {
          this.color = { r: 74, g: 14, b: 23 }; // Deep Burgundy Glow
          this.radius = Math.random() * 15 + 10; // Large glowing dust orb
        }
        this.alpha = Math.random() * 0.5 + 0.1;
        this.speedX = Math.random() * 0.6 - 0.3;
        this.speedY = -(Math.random() * 0.5 + 0.2); // Move upwards
        this.decay = Math.random() * 0.002 + 0.001;
        this.wobbleSpeed = Math.random() * 0.02;
        this.wobbleRange = Math.random() * 1.5;
        this.wobble = Math.random() * Math.PI * 2;
      }

      update() {
        // Linear movement
        this.y += this.speedY;
        this.wobble += this.wobbleSpeed;
        this.x += this.speedX + Math.sin(this.wobble) * this.wobbleRange * 0.1;

        // Interaction with mouse pointer
        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          this.x -= (dx / dist) * force * 0.6;
          this.y -= (dy / dist) * force * 0.6;
        }

        // Slowly float out of bounds or fade away
        if (this.y < -20 || this.x < -20 || this.x > canvas.width + 20) {
          this.reset(false);
        }
      }

      draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        if (this.radius > 5) {
          // Large glowing orb
          const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
          gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.4})`);
          gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
          ctx.fillStyle = gradient;
        } else {
          // Small spark
          ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.5)`;
        }
        
        ctx.fill();
        ctx.restore();
      }
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    // Animation Loop
    const animate = () => {
      // Ease mouse coordinates
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render dark backdrop gradient
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
      );
      bgGrad.addColorStop(0, '#120708'); // Dark maroon central glow
      bgGrad.addColorStop(1, '#050203'); // Charcoal black edges
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and Draw particles
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      if (hasFinePointer) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full pointer-events-none z-0" 
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default Particles;
