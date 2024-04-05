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
