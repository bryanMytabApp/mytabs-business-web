export function setCookie(name: string, value: string) {
    let cookieString = `${name}=${value}`;
    document.cookie = cookieString;
}

export function getCookie(name: string) {
    const cookies = document.cookie.split("; ");

    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split("=");
        if (cookieName === name) {
            return cookieValue;
        }
    }

    return null;
}

export function deleteCookie(cookieName: string) {
    const date = new Date(0);
    document.cookie = `${cookieName}=;expires=${date.toUTCString()};path=/`;
}