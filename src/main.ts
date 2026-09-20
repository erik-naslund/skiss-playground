import './style.css';
import { mount } from './page';

const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('index.html must carry an element with id "app"');
}

mount(app);
