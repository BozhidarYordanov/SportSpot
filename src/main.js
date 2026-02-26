import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import './styles/main.css';
import './styles/app.css';
import './components/header/header.css';
import './components/footer/footer.css';

import { initRouter } from './router';

const appElement = document.querySelector('#app');

if (!appElement) {
	throw new Error('App root element not found.');
}

initRouter(appElement);
