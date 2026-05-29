import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GlossaryView from '../views/GlossaryView.vue'
import { normalizeLocale } from '@/utils/i18n'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/en',
    },
    {
      path: '/:locale(en|fr)',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/:locale(en|fr)/glossary',
      name: 'glossary',
      component: GlossaryView,
    },
  ],
})

router.beforeEach((to) => {
  if (to.params.locale) {
    to.params.locale = normalizeLocale(to.params.locale)
  }
})

export default router
