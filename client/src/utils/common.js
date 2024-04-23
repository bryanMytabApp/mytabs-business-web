import config from '../config.json'
let { bucketUrl } = config

export const generateAssetUrl = (src = '') => {
	if (!src)
		return ''
	src = src.startsWith('/') ? src.substring(1, src.length) : src
	return bucketUrl + src
}

export const getEventPicture = (id = '') => {
	return generateAssetUrl(`events/${id}`)
}

export const getBusinessPicture = (id = '') => {
	return generateAssetUrl(`business/${id}`)
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
};