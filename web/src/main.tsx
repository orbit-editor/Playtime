import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBoot } from './app/AppBoot';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/home.css';
import './styles/identify.css';
import './styles/screens.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('页面缺少根节点，无法启动');
}

createRoot(container).render(
  <StrictMode>
    <AppBoot />
  </StrictMode>,
);
