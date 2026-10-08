/// <reference types="vite/client" />

// @types/react-dom não está instalado (só @types/react) — sem isso, `react-dom/client`
// (usado em main.tsx) não tem declaração e vira implicit any.
declare module 'react-dom/client';
