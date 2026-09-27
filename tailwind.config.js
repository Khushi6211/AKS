/**
 * Tailwind build for the account/checkout/admin pages.
 * The storefront (index.html) uses assets/css/app.css only.
 * Rebuild after editing any page:  npm run build:css
 */
module.exports = {
    content: ['./*.html', '!./index.html'],
    theme: {
        extend: {
            colors: {
                primary: '#b45f24',
                secondary: '#f4b740',
                accent: '#d9822b',
                dark: '#1d1d1f',
                light: '#f4efe8',
            },
            fontFamily: {
                heading: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
            },
        },
    },
};
