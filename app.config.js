/**
 * The app config lives in app.json; this only adds the pieces that are not
 * always wanted.
 *
 * The Home Screen widget needs an App Group, and an App Group may not be
 * signable with a free Apple ID. Building it is therefore opt-in:
 *
 *   EXPENSES_WIDGET=1 npx expo prebuild --platform ios --clean
 *
 * Without the flag the app is exactly what it has always been, so the install
 * that is known to work cannot be broken by a widget that will not sign.
 */
const app = require('./app.json');

const APP_GROUP = 'group.com.nicklane123.expenses';

// The widget plugin warns that `ios.appleTeamId` is missing. The cloud build is
// unsigned and Sideloadly signs afterwards, so there is nothing to set here;
// add the team ID to app.json if you ever build with a paid account.

module.exports = () => {
  if (process.env.EXPENSES_WIDGET !== '1') return app;

  return {
    ...app,
    expo: {
      ...app.expo,
      ios: {
        ...app.expo.ios,
        entitlements: {
          ...app.expo.ios.entitlements,
          'com.apple.security.application-groups': [APP_GROUP],
        },
      },
      plugins: [...app.expo.plugins, '@bacons/apple-targets'],
    },
  };
};
