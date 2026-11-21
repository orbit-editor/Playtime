import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Stage } from '../components/Stage';
import { ToastProvider } from '../components/Toast';
import { ScreenBoard } from '../screens/ScreenBoard';
import { ScreenHome } from '../screens/ScreenHome';
import { ScreenMe } from '../screens/ScreenMe';
import { ScreenPlay } from '../screens/ScreenPlay';
import { ScreenJoin, ScreenNotFound, ScreenSetup } from '../screens/PlaceholderScreens';
import { ScreenMobileApp } from '../screens/mobile/ScreenMobileApp';
import { ScreenWorkbench } from '../screens/workbench/ScreenWorkbench';

/** 大屏页面按 1920×1080 等比缩放；手机版自己排版，不套缩放舞台。 */
function BigScreen() {
  return (
    <Stage>
      <Routes>
        <Route path="/" element={<ScreenHome />} />
        <Route path="/board" element={<ScreenBoard />} />
        <Route path="/me" element={<ScreenMe />} />
        <Route path="/play/:pluginId" element={<ScreenPlay />} />
        <Route path="/admin" element={<ScreenWorkbench />} />
        <Route path="/join" element={<ScreenJoin />} />
        <Route path="/setup" element={<ScreenSetup />} />
        <Route path="*" element={<ScreenNotFound />} />
      </Routes>
    </Stage>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/m/*" element={<ScreenMobileApp />} />
          <Route path="*" element={<BigScreen />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
