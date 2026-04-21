/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'stories/**/*.stories.{ts,tsx,mdx}',
  addons: {
    theme: {
      enabled: true,
      defaultState: 'light',
    },
    mode: {
      enabled: true,
      defaultState: 'full',
    },
    width: {
      enabled: true,
      options: {
        mobile: 360,
        tablet: 768,
        desktop: 1024,
      },
    },
  },
}
