import i18n from '../i18n';

/**
 * Robust localization extractor that guarantees a string is returned.
 * Prevents React Error #31 (Objects are not valid as a React child).
 *
 * @param {any} field - The field which may be a string, object (e.g. { en: "..." }), array, etc.
 * @param {string} defaultVal - Default fallback string
 * @param {number} depth - Recursion guard depth
 * @returns {string} Safe string representation
 */
export const getLocalizedStr = (field, defaultVal = '', depth = 0) => {
    if (depth > 5) return String(defaultVal || '');
    if (field === null || field === undefined) return String(defaultVal || '');

    // Primitives
    if (typeof field === 'string') return field.trim();
    if (typeof field === 'number' || typeof field === 'boolean') return String(field);

    // Arrays
    if (Array.isArray(field)) {
        if (field.length === 0) return String(defaultVal || '');
        return getLocalizedStr(field[0], defaultVal, depth + 1);
    }

    // Objects
    if (typeof field === 'object') {
        const lang = (i18n && i18n.language) ? i18n.language : 'en';
        const isHindi = typeof lang === 'string' && lang.startsWith('hi');

        // Check language-specific keys first based on active language
        const preferredKey = isHindi ? 'hi' : 'en';
        const fallbackKey = isHindi ? 'en' : 'hi';

        const candidates = [
            field[preferredKey],
            field[fallbackKey],
            field.value,
            field.name,
            field.title,
            field.label,
            field.text,
            field.description,
            ...Object.values(field)
        ];

        for (const candidate of candidates) {
            if (candidate !== null && candidate !== undefined && candidate !== '') {
                const resolved = getLocalizedStr(candidate, '', depth + 1);
                if (resolved && typeof resolved === 'string' && resolved.trim()) {
                    return resolved.trim();
                }
            }
        }
    }

    return String(defaultVal || '');
};

export default getLocalizedStr;
