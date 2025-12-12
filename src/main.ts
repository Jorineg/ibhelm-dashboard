import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import { initErrorLogging } from './composables/useLogtail'
import { setupGlobalSelectOnFocus } from './directives/selectOnFocus'

// PrimeVue CSS - Dark Theme
import 'primevue/resources/themes/lara-dark-blue/theme.css'
import 'primevue/resources/primevue.min.css'
import 'primeicons/primeicons.css'

// Unified application styles
import './styles/index.css'

initErrorLogging()
setupGlobalSelectOnFocus()

const app = createApp(App)

app.use(router)
app.use(PrimeVue)

app.mount('#app')

