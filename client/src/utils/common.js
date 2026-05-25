import { Buffer } from 'buffer';
import config from '../config.json'

let { bucketUrl } = config

export const generateAssetUrl = (src = '') => {
	if (!src)
		return ''
	src = src.startsWith('/') ? src.substring(1, src.length) : src
	return bucketUrl + src
}

/**
 * Get event picture URL
 * @param {string} id - Event ID
 * @param {string} size - Optional size: 'thumb' (200px), 'medium' (400px), or 'full' (original)
 * @returns {string} Image URL
 */
export const getEventPicture = (id = '', size = 'full') => {
	if (!id) return '';
	
	if (size === 'thumb') {
		return generateAssetUrl(`thumbnails/events/${id}_200`);
	} else if (size === 'medium') {
		return generateAssetUrl(`thumbnails/events/${id}_400`);
	}
	return generateAssetUrl(`events/${id}`);
}

/**
 * Get event thumbnail URL (200x200) - optimized for list views
 * @param {string} id - Event ID
 * @returns {string} Thumbnail URL
 */
export const getEventThumbnail = (id = '') => {
	return getEventPicture(id, 'thumb');
}

/**
 * Get business picture URL
 * @param {string} id - Business ID (userId)
 * @param {string} size - Optional size: 'thumb' (200px), 'medium' (400px), or 'full' (original)
 * @param {number|string} [iconUpdatedAt] - Optional timestamp/version for cache busting
 * @returns {string} Image URL
 */
export const getBusinessPicture = (id = '', size = 'full', iconUpdatedAt) => {
	if (!id) return '';
	
	let url;
	if (size === 'thumb') {
		url = generateAssetUrl(`thumbnails/business/${id}_200`);
	} else if (size === 'medium') {
		url = generateAssetUrl(`thumbnails/business/${id}_400`);
	} else {
		url = generateAssetUrl(`business/${id}`);
	}
	if (iconUpdatedAt) {
		url += `?v=${iconUpdatedAt}`;
	}
	return url;
}

/**
 * Get business thumbnail URL (200x200) - optimized for list views
 * @param {string} id - Business ID (userId)
 * @param {number|string} [iconUpdatedAt] - Optional timestamp/version for cache busting
 * @returns {string} Thumbnail URL
 */
export const getBusinessThumbnail = (id = '', iconUpdatedAt) => {
	return getBusinessPicture(id, 'thumb', iconUpdatedAt);
}

export const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');

export const applySearch = (search, items, attrs = []) => {
	if(!search)
		return items
	if(!attrs.length){
		for(let attr in items[0]){
			attrs.push(attr)
		}
	}
	let filteredItems = []
	for(let item of items){
		for(let attr of attrs){
			if(
				( typeof item[attr] === 'string' && normalizeIncludes(item[attr], search) ) ||
				( typeof item[attr] === 'number' && normalizeIncludes(item[attr].toString(), search) )
			){
				filteredItems.push(item)
				break
			}
		}
	}
	return filteredItems
}

export const normalizeText = (text, toLower = false) => {
	text = '' + text
	if(toLower)
		text = text.toLowerCase();
	return text.normalize('NFD').replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,"$1").normalize();
}

export const normalizeIncludes = (str, search) => {
	return normalizeText( str, true ).includes( normalizeText(search, true) )
}

export const parseJwt = (token) => {
	// Check if token exists and is valid
	if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
		console.warn('Invalid or missing JWT token');
		return null;
	}

	try {
		const base64Url = token.split(".")[1];
		const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split("")
				.map(function (c) {
					return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
				})
				.join("")
		);

		return JSON.parse(jsonPayload)["custom:user_id"];
	} catch (error) {
		console.error('Error parsing JWT token:', error);
		return null;
	}
};

export const getUserIdCognito =  async ( token ) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString();

    return JSON.parse(jsonPayload)["cognito:username"];
  } catch (err) {
    console.error("Error parsing JWT:", err);
    return null;
  }
};