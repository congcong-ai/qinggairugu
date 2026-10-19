export default defineAppConfig({
  pages: [
    'pages/session/index',
    'pages/profile/edit',
    'pages/session/people',
    'pages/session/recap',
    'pages/me/index',
    'pages/me/sessions',
  ],
  window: {
    navigationBarTitleText: '倾盖如故',
    navigationBarBackgroundColor: '#F7F4EE',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F4EE',
  },
  tabBar: {
    color: '#72786C',
    selectedColor: '#426B4E',
    backgroundColor: '#F7F4EE',
    list: [
      { pagePath: 'pages/session/index', text: '这场' },
      { pagePath: 'pages/session/people', text: '都有谁' },
      { pagePath: 'pages/session/recap', text: '回顾' },
      { pagePath: 'pages/me/index', text: '我的' },
    ],
  },
});
