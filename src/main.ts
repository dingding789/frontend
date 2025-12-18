import { createApp } from 'vue';
import App from './App.vue';
import './assets/style.css';
import './CAE/initSimulationToolbar';
import { pinia } from './CAE/piniaInstance'; // 1. 引入共享的 pinia
const app = createApp(App);

//createApp(App).mount('#app');

app.use(pinia); // 2. 安装 pinia
app.mount('#app');