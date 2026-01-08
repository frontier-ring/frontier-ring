const cIcons = {
    "dark": `<svg viewBox="-1 0 19 19" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg"><path d="M16.417 9.579A7.917 7.917 0 1 1 8.5 1.662a7.917 7.917 0 0 1 7.917 7.917zm-12.94.396H4.58a.396.396 0 0 0 0-.792H3.477a.396.396 0 0 0 0 .792zm1.19-3.667.781.781a.396.396 0 0 0 .56-.56l-.78-.78a.396.396 0 0 0-.56.56zm1.341 5.76a.396.396 0 0 0-.56 0l-.78.781a.396.396 0 1 0 .56.56l.78-.78a.396.396 0 0 0 0-.56zm5.59-2.489a3.096 3.096 0 1 0-3.095 3.096 3.096 3.096 0 0 0 3.096-3.096zM8.103 5.662a.396.396 0 0 0 .792 0V4.558a.396.396 0 0 0-.792 0zm.792 7.834a.396.396 0 0 0-.792 0V14.6a.396.396 0 1 0 .792 0zm2.094-6.407a.396.396 0 0 0 .56 0l.78-.78a.396.396 0 0 0-.56-.56l-.78.78a.395.395 0 0 0 0 .56zm1.34 5.76-.78-.78a.396.396 0 0 0-.56.56l.78.78a.396.396 0 0 0 .56-.56zm1.587-3.27a.396.396 0 0 0-.396-.396h-1.104a.396.396 0 1 0 0 .792h1.104a.396.396 0 0 0 .396-.396z"/></svg>`,
    "light":`<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><path d="M 27.9999 51.9062 C 41.0546 51.9062 51.9063 41.0547 51.9063 28.0000 C 51.9063 14.9219 41.0312 4.0938 27.9765 4.0938 C 14.8983 4.0938 4.0937 14.9219 4.0937 28.0000 C 4.0937 41.0547 14.9218 51.9062 27.9999 51.9062 Z M 34.9374 32.9453 C 36.5546 32.9453 38.1952 32.5938 39.1796 32.2422 C 39.4374 32.1719 39.6014 32.1484 39.7421 32.1484 C 40.1171 32.1484 40.5155 32.4766 40.5155 32.9687 C 40.5155 33.0625 40.4921 33.3672 40.3749 33.6719 C 38.6874 37.9375 33.8358 41.3828 28.2109 41.3828 C 20.4999 41.3828 14.6171 35.875 14.6171 28.1640 C 14.6171 22.6562 17.8749 17.4062 22.7265 15.4844 C 23.0312 15.3672 23.3124 15.3438 23.4765 15.3438 C 23.9687 15.3438 24.2499 15.7422 24.2499 16.0938 C 24.2499 16.2109 24.2265 16.3984 24.1093 16.7031 C 23.6874 17.8047 23.2890 19.8906 23.2890 21.3672 C 23.2890 28.4687 27.8358 32.9453 34.9374 32.9453 Z"/></svg>`
}
const cIcon = document.getElementById('themeIcon');

function setStartTheme(){
    let targetColorTheme = '';
    let currentTheme = localStorage.getItem('color-theme');
    if (currentTheme != null) {
        targetColorTheme = currentTheme
    } else { 
        const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)");
        if (darkThemeMq.matches) {
            targetColorTheme = 'dark';
        } else {
            targetColorTheme = 'light';
        }
    }
    cIcon.innerHTML = cIcons[targetColorTheme];
    document.documentElement.setAttribute('color-theme', targetColorTheme);
    localStorage.setItem('color-theme',targetColorTheme);
}

function switchTheme() {
    current = document.documentElement.getAttribute('color-theme')
    if (current == 'dark') {
        targetColorTheme = 'light';
    }
    if ( current == 'light') {
        targetColorTheme = 'dark';
    }
    document.documentElement.setAttribute('color-theme', targetColorTheme);
    cIcon.innerHTML = cIcons[targetColorTheme];
    localStorage.setItem('color-theme',targetColorTheme);
}


document.getElementById("themeIcon").addEventListener("click", switchTheme);