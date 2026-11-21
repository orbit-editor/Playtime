import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Stage } from '../components/Stage';
import { ToastProvider } from '../components/Toast';
import { ScreenBoard } from '../screens/ScreenBoard';
import { ScreenHome } from '../screens/ScreenHome';
import { ScreenMe } from '../screens/ScreenMe';
import { ScreenPlay } from '../screens/ScreenPlay';
import {
  ScreenAdmin,
  ScreenJoin,
  ScreenMobile,
  ScreenNotFound,
  ScreenSetup,
} from '../screens/PlaceholderScreens';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Stage>
          <Routes>
            <Route path="/" element={<ScreenHome />} />
            <Route path="/board" element={<ScreenBoard />} />
            <Route path="/me" element={<ScreenMe />} />
            <Route path="/play/:pluginId" element={<ScreenPlay />} />
            <Route path="/admin" element={<ScreenAdmin />} />
            <Route path="/m" element={<ScreenMobile />} />
            <Route path="/join" element={<ScreenJoin />} />
            <Route path="/setup" element={<ScreenSetup />} />
            <Route path="*" element={<ScreenNotFound />} />
          </Routes>
        </Stage>
      </ToastProvider>
    </BrowserRouter>
  );
}
