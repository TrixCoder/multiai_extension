/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'selector', // 'selector' is the modern equivalent of 'class'
    theme: {
        extend: {},
    },
    plugins: [],
}
