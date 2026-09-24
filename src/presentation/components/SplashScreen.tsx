import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

export const SplashScreen: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Mantener la pantalla principal por 1.5s
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1500);

    // Ocultar completamente del DOM tras la transición (500ms)
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{...styles.container, ...(isFadingOut ? styles.fadeOut : {})}}>
      <style>
        {`
          @keyframes pulse-glow {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
            70% { box-shadow: 0 0 0 20px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
          }
          @keyframes slide-up-fade {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes line-draw {
            0% { stroke-dasharray: 100; stroke-dashoffset: 100; }
            100% { stroke-dasharray: 100; stroke-dashoffset: 0; }
          }
        `}
      </style>
      
      <div style={styles.logoCircle}>
        <Activity size={48} color="#3b82f6" strokeWidth={2.5} style={styles.icon} />
      </div>
      
      <div style={styles.textContainer}>
        <h1 style={styles.title}>EKO WISER</h1>
        <p style={styles.subtitle}>Spectroradiometer Analyzer</p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0a0a0a', // Ligeramente más oscuro que el fondo normal
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999, // Asegurar que esté por encima de todo
    transition: 'opacity 0.5s ease-in-out, visibility 0.5s ease-in-out',
    opacity: 1,
    visibility: 'visible',
  },
  fadeOut: {
    opacity: 0,
    visibility: 'hidden',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    backgroundColor: '#161616',
    border: '1px solid #2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    animation: 'pulse-glow 2s infinite',
  },
  icon: {
    animation: 'line-draw 1.5s ease-in-out forwards',
  },
  textContainer: {
    textAlign: 'center',
    animation: 'slide-up-fade 0.8s ease-out forwards',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '0.1em',
    margin: '0 0 8px 0',
  },
  subtitle: {
    color: '#888888',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em',
    margin: 0,
  }
};
