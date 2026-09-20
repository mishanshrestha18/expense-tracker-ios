/**
 * The Home Screen and Lock Screen widget. Only built when EXPENSES_WIDGET=1,
 * because it needs an App Group, which a free Apple ID may not be allowed to
 * sign (see docs/install-on-iphone.md).
 */
module.exports = {
  type: 'widget',
  name: 'Expenses Widget',
  icon: '../../assets/images/icon.png',
  deploymentTarget: '17.0',
  colors: {
    WidgetBackground: { color: '#F6F8F7', darkColor: '#131A16' },
    WidgetInk: { color: '#0A0D0B', darkColor: '#F4F6F5' },
    WidgetTint: { color: '#047857', darkColor: '#34D399' },
  },
};
