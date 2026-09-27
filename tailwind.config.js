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
                primary: '#c4531a',
                secondary: '#c49a52',
                accent: '#16110d',
                dark: '#1c1510',
                light: '#efe7d9',
            },
            fontFamily: {
                heading: ['Cormorant Garamond', 'Georgia', 'serif'],
                body: ['Inter Variable', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
            },
        },
    },
};
