import React from 'react';
import { createRoot } from 'react-dom/client';
import SolarAtlas from './SolarAtlas.jsx';
import './solar.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><SolarAtlas /></React.StrictMode>,
);
