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
                primary: '#2f6b4f',
                secondary: '#f5a524',
                accent: '#e0673c',
                dark: '#2f241b',
                light: '#fff8ee',
            },
            fontFamily: {
                heading: ['Fraunces Variable', 'Georgia', 'serif'],
                body: ['DM Sans Variable', 'Inter Variable', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
            },
        },
    },
};
