import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
import '@xterm/xterm/css/xterm.css';

import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
