export default defineAppConfig({
  pages: [
    'pages/activity/index',
    'pages/activity/edit',
    'pages/activity/create',
    'pages/activity/start',
    'pages/activity/claim',
    'pages/activity/results',
    'pages/binding/index',
    'pages/session/index',
    'pages/profile/edit',
    'pages/session/people',
    'pages/session/recap',
    'pages/me/index',
    'pages/me/privacy',
    'pages/me/about',
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
      {
        pagePath: 'pages/activity/index',
        text: '我的活动',
        iconPath: 'assets/tabs/records-idle.png',
        selectedIconPath: 'assets/tabs/records-active.png',
      },
      {
        pagePath: 'pages/me/index',
        text: '我的',
        iconPath: 'assets/tabs/me-idle.png',
        selectedIconPath: 'assets/tabs/me-active.png',
      },
    ],
  },
});
