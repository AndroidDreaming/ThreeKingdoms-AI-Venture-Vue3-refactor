import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'index',
    component: () => import('@/features/game-shell/GameShellPage.vue')
  },
  {
    path: '/admin/content',
    name: 'content-admin',
    component: () => import('@/views/admin/ContentConfigPage.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
