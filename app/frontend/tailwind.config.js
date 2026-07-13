/** Tailwind build for the candidate frontend — scans the HTML (incl. inline JS
 *  template strings) and the JS files so all utility classes are compiled. */
module.exports = {
  content: ['./index.html', './user/*.html', './assets/js/*.js'],
  theme: { extend: {} },
  plugins: [],
};
