import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'index',
    component: () => import('@/features/game-shell/GameShellPage.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
