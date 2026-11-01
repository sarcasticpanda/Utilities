const $ = (selector) => document.querySelector(selector);
const fileInput = $('#geo-file');
const imagePreview = $('#geo-preview-image');
let sourceFile = null;
let sourceUrl = null;
let resultUrl = null;
let sourceDimensions = null;
let piexifPromise;
let cameraStream = null;
let mapInstance = null;
let mapMarker = null;
let leafletPromise;
let lastGeocoderRequestAt = 0;
let reverseLookupBusy = false;
let placeSearchBusy = false;
let autoPlaceLabel = false;
let autoPlaceDetails = '';
let cameraFacingMode = 'environment';
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;

function setStatus(message, error = false) {
  const status = $('#geo-status'); status.textContent = message; status.classList.toggle('is-error', error);
}

function setCameraStatus(message, error = false) {
  const status = $('#geo-camera-status'); status.textContent = message; status.classList.toggle('is-error', error);
}

function showCameraPanel(visible) {
  $('#geo-camera-panel').hidden = !visible;
  $('#geo-preview-frame').hidden = visible;
}

function clearAutoPlaceLabel() {
  if (!autoPlaceLabel) return;
  $('#geo-place').value = '';
  autoPlaceLabel = false;
  autoPlaceDetails = '';
  setPlaceStatus('Coordinates changed. Search again or enter the place label yourself.');
}

function setLocationStatus(message, error = false) {
  const status = $('#geo-location-status'); status.textContent = message; status.classList.toggle('is-error', error);
}

function setPlaceStatus(message, error = false) {
  const status = $('#geo-place-status'); status.textContent = message; status.classList.toggle('is-error', error);
}

function setMapSearchStatus(message, error = false) {
  const status = $('#geo-map-search-status'); status.textContent = message; status.classList.toggle('is-error', error);
}

function currentCoordinates() {
  const latitude = Number($('#geo-latitude').value);
  const longitude = Number($('#geo-longitude').value);
  if (!$('#geo-latitude').value.trim() || !$('#geo-longitude').value.trim()) return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function setReadyState() {
  const coordinates = currentCoordinates();
  $('#geo-create').disabled = !sourceFile || !coordinates;
  if (coordinates) {
    setLocationStatus(`Location ready · ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`);
  } else if ($('#geo-latitude').value || $('#geo-longitude').value) {
    setLocationStatus('Enter a valid latitude from −90 to 90 and longitude from −180 to 180.', true);
  } else {
    setLocationStatus('Add coordinates to continue. A location is never guessed.');
  }
  updateStampPreview();
  updateGoogleMapsLink();
  updateMapMarker();
  $('#geo-reverse-lookup').disabled = !coordinates || reverseLookupBusy;
}

function updateGoogleMapsLink() {
  const link = $('#geo-open-google-map');
  const coordinates = currentCoordinates();
  link.hidden = !coordinates;
  if (coordinates) link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}`;
}

function updateMapMarker() {
  const coordinates = currentCoordinates();
  if (!mapInstance) return;
  if (!coordinates) { if (mapMarker) mapInstance.removeLayer(mapMarker); mapMarker = null; return; }
  const point = [coordinates.latitude, coordinates.longitude];
  if (mapMarker) mapMarker.setLatLng(point);
  else {
    mapMarker = window.L?.marker(point, { draggable: true }).addTo(mapInstance) || null;
    $('#geo-map')._quickkitMarker = mapMarker;
    mapMarker?.on('dragend', () => {
      const moved = mapMarker.getLatLng();
      clearAutoPlaceLabel();
      $('#geo-latitude').value = moved.lat.toFixed(7);
      $('#geo-longitude').value = moved.lng.toFixed(7);
      setReadyState();
      setPlaceStatus('Pin moved. The coordinates now match its new position.');
      setStatus('Map pin moved. Check the coordinates before creating the photo.');
    });
  }
}

function getMapLabel(result) {
  return result.name || result.address?.park || result.address?.neighbourhood || result.address?.suburb || result.address?.village || result.address?.town || result.address?.city || result.display_name?.split(',')[0]?.trim() || '';
}

function getMapAddress(result, label = getMapLabel(result)) {
  const address = result.address || {};
  const parts = [address.neighbourhood, address.suburb, address.city_district, address.district, address.county, address.state_district, address.city, address.town, address.village, address.state, address.postcode, address.country]
    .filter(Boolean)
    .filter((part, index, values) => values.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index)
    .filter((part) => part.toLocaleLowerCase() !== label.toLocaleLowerCase());
  return parts.slice(0, 5).join(', ').slice(0, 110);
}

async function requestPlaceService(url, statusWriter) {
  const waitMs = 1000 - (Date.now() - lastGeocoderRequestAt);
  if (waitMs > 0) {
    statusWriter(`Waiting ${Math.ceil(waitMs / 1000)} second before the next OpenStreetMap place lookup…`);
    await new Promise((resolve) => setTimeout(resolve, waitMs + 40));
  }
  lastGeocoderRequestAt = Date.now();
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'default' });
  if (response.status === 429) throw new Error('OpenStreetMap is rate-limiting place lookups. Wait a little, or choose the point on the map and enter its label yourself.');
  if (!response.ok) throw new Error('The place lookup service is unavailable. Choose the point on the map and enter its label yourself.');
  return response.json();
}

function choosePlace(result) {
  const latitude = Number(result.lat); const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
  const label = getMapLabel(result);
  $('#geo-latitude').value = latitude.toFixed(7);
  $('#geo-longitude').value = longitude.toFixed(7);
  if (label) { $('#geo-place').value = label.slice(0, 70); autoPlaceLabel = true; autoPlaceDetails = getMapAddress(result, label); }
  setReadyState();
  if (mapInstance) { mapInstance.setView([latitude, longitude], 17); updateMapMarker(); requestAnimationFrame(() => mapInstance?.invalidateSize()); }
  setMapSearchStatus(`Selected ${label || 'map result'}. Confirm the pin and coordinates before exporting.`);
  setPlaceStatus(label ? `Place label added: ${label}. Review it before export.` : 'Coordinates selected. Add a place label if you want one printed.');
  setStatus('Place selected. Check the coordinates and time before creating the photo.');
}

async function searchPlaces() {
  const query = $('#geo-place-query').value.trim();
  if (query.length < 3) { setMapSearchStatus('Enter at least 3 characters to search for a place.', true); return; }
  const button = $('#geo-place-search'); const resultList = $('#geo-map-results');
  placeSearchBusy = true; button.disabled = true; button.textContent = 'Searching…'; resultList.replaceChildren(); resultList.hidden = true;
  setMapSearchStatus('Searching OpenStreetMap for that place…');
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '5', 'accept-language': navigator.language || 'en' }).toString();
    const results = await requestPlaceService(url, setMapSearchStatus);
    if (!results) return;
    if (!results.length) { setMapSearchStatus('No matching places found. Try adding the city or region, or tap the map instead.'); return; }
    for (const result of results) {
      const item = document.createElement('li'); const option = document.createElement('button');
      option.type = 'button';
      const label = document.createElement('strong'); label.textContent = getMapLabel(result) || 'Unnamed place';
      const description = document.createElement('span'); description.textContent = result.display_name || `${result.lat}, ${result.lon}`;
      option.append(label, description); option.addEventListener('click', () => choosePlace(result)); item.append(option); resultList.append(item);
    }
    resultList.hidden = false;
    setMapSearchStatus(`Choose the correct result from ${results.length} matches. Map names can be incomplete or approximate.`);
  } catch (error) {
    setMapSearchStatus(error?.message || 'Place search failed. Tap the map or enter coordinates manually.', true);
  } finally {
    placeSearchBusy = false; button.disabled = false; button.textContent = 'Search map';
  }
}

async function reverseLookupPlace() {
  const coordinates = currentCoordinates();
  if (!coordinates) return;
  const button = $('#geo-reverse-lookup');
  reverseLookupBusy = true; button.disabled = true; button.textContent = 'Finding place…';
  setPlaceStatus('Looking up a nearby map label. Exact coordinates are sent to OpenStreetMap because you pressed this button.');
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({ lat: String(coordinates.latitude), lon: String(coordinates.longitude), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': navigator.language || 'en' }).toString();
    const result = await requestPlaceService(url, setPlaceStatus);
    if (!result) return;
    const current = currentCoordinates();
    if (!current || current.latitude !== coordinates.latitude || current.longitude !== coordinates.longitude) { setPlaceStatus('Coordinates changed while searching. Press the button again to look up the new point.', true); return; }
    const label = getMapLabel(result);
    if (!label) { setPlaceStatus('No nearby name was found. Add a place label yourself or choose a nearby map point.', true); return; }
    $('#geo-place').value = label.slice(0, 70); autoPlaceLabel = true; autoPlaceDetails = getMapAddress(result, label);
    removeResult(); updateStampPreview();
    setPlaceStatus(`Nearby map label: ${label}. Review the name; this does not verify you are there.`);
  } catch (error) {
    setPlaceStatus(error?.message || 'Place lookup failed. You can enter a label yourself.', true);
  } finally {
    reverseLookupBusy = false; button.textContent = 'Find place name from these coordinates';
    button.disabled = !currentCoordinates();
  }
}

async function showMap() {
  const panel = $('#geo-map-panel');
  panel.hidden = false;
  $('#geo-map-open').setAttribute('aria-expanded', 'true');
  try {
    const [module] = await (leafletPromise ||= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]));
    const L = module.default;
    window.L = L;
    if (!mapInstance) {
      const coordinates = currentCoordinates();
      mapInstance = L.map('geo-map', { scrollWheelZoom: false, zoomControl: true }).setView(coordinates ? [coordinates.latitude, coordinates.longitude] : [20, 0], coordinates ? 14 : 2);
      $('#geo-map')._quickkitMap = mapInstance;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
      }).addTo(mapInstance);
      mapInstance.on('click', (event) => {
        clearAutoPlaceLabel();
        $('#geo-latitude').value = event.latlng.lat.toFixed(7);
        $('#geo-longitude').value = event.latlng.lng.toFixed(7);
        setReadyState();
        setPlaceStatus('Map point set. Use “Find place name” to look up a nearby label, or type one yourself.');
        setStatus('Map point selected. Check the coordinates before creating the photo.');
      });
    } else {
      const coordinates = currentCoordinates();
      if (coordinates) mapInstance.setView([coordinates.latitude, coordinates.longitude], Math.max(14, mapInstance.getZoom()));
    }
    updateMapMarker();
    requestAnimationFrame(() => mapInstance?.invalidateSize());
  } catch {
    setLocationStatus('The map could not load. Enter coordinates manually or use the Google Maps link.', true);
  }
}

function hideMap() {
  $('#geo-map-panel').hidden = true;
  $('#geo-map-open').setAttribute('aria-expanded', 'false');
}

async function listCameras() {
  const select = $('#geo-camera-device');
  const prior = cameraStream?.getVideoTracks()[0]?.getSettings().deviceId || select.value;
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
  select.replaceChildren(...devices.map((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    return option;
  }));
  if (devices.some((device) => device.deviceId === prior)) select.value = prior;
  select.parentElement.hidden = devices.length < 2;
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  const video = $('#geo-camera-video');
  if (video) { video.pause(); video.srcObject = null; }
  const capture = $('#geo-camera-capture');
  if (capture) capture.disabled = true;
  const tagLocation = $('#geo-camera-tag-location');
  if (tagLocation) tagLocation.disabled = true;
}

function closeCamera() {
  stopCamera();
  showCameraPanel(false);
  setCameraStatus('Camera is off. Choose Use camera to show the live preview.');
  setStatus('Camera closed. Choose a photo or open the camera when ready.');
}

async function openCamera(deviceId = '', facingMode = cameraFacingMode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus('This browser cannot access a camera here. Choose a saved photo instead.', true);
    setStatus('This browser cannot access a camera here. Use a secure browser tab or choose a saved photo.', true);
    return;
  }
  stopCamera();
  showCameraPanel(true);
  setCameraStatus('Waiting for camera permission…');
  setStatus('Waiting for camera permission…');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facingMode } }), width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = $('#geo-camera-video');
    video.srcObject = cameraStream;
    await video.play();
    $('#geo-camera-capture').disabled = false;
    $('#geo-camera-tag-location').disabled = false;
    $('#geo-camera-flip').dataset.facingMode = facingMode;
    await listCameras();
    setCameraStatus('Camera ready. Capture a frame, then check the photo below.');
    setStatus('Camera ready. Capture a frame, then choose or confirm its location.');
  } catch (error) {
    stopCamera();
    showCameraPanel(false);
    const message = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser or choose a saved photo.' : error.name === 'NotFoundError' ? 'No camera was found. Choose a saved photo instead.' : 'The camera could not start. Close other apps using it, then try again.';
    setCameraStatus(message, true);
    setStatus(message, true);
  }
}

async function flipCamera() {
  cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
  $('#geo-camera-device').value = '';
  setCameraStatus(`Switching to the ${cameraFacingMode === 'user' ? 'front' : 'rear'} camera…`);
  await openCamera('', cameraFacingMode);
}

async function capturePhoto({ tagCurrentLocation = false } = {}) {
  const video = $('#geo-camera-video');
  if (!video.videoWidth || !video.videoHeight) { setStatus('Wait for the camera preview to appear before capturing.', true); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
  canvas.width = 0; canvas.height = 0;
  if (!blob) { setStatus('The camera frame could not be captured. Try again or choose a saved photo.', true); return; }
  const capturedAt = new Date();
  const photo = new File([blob], `quickkit-camera-${capturedAt.toISOString().replace(/[:.]/gu, '-')}.jpg`, { type: 'image/jpeg' });
  $('#geo-date').value = dateForInput(capturedAt); updateStampPreview();
  stopCamera();
  showCameraPanel(false);
  await loadPhoto(photo);
  if (tagCurrentLocation) {
    setCameraStatus('Photo captured. Asking for your current location…');
    const located = await requestCurrentLocation();
    if (!located) {
      setCameraStatus('Photo captured, but the device location was unavailable. Choose the map or enter coordinates, then create the tagged photo.', true);
      return;
    }
    await createGeoPhoto();
    setCameraStatus('Photo captured and tagged with the current coordinates and capture time. Check the preview before downloading.');
    return;
  }
  setCameraStatus('Camera photo captured and ready. Use “Capture & tag current location” or choose a point on the map.');
  setStatus('Camera photo ready. Add a place or current coordinates before making the tagged photo.');
}

function dateForInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateValue() {
  const parsed = new Date($('#geo-date').value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function locationLabel() {
  const coordinates = currentCoordinates();
  const place = $('#geo-place').value.trim();
  if (place) return place;
  if (coordinates) return `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
  return 'Location';
}

function stampText() {
  const date = dateValue();
  const dateText = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  const zone = new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' }).format(date).split(' ').at(-1);
  const coordinates = currentCoordinates();
  return { place: locationLabel(), address: autoPlaceDetails, coordinates: coordinates ? `Lat ${coordinates.latitude.toFixed(6)}, Long ${coordinates.longitude.toFixed(6)}` : 'Latitude · Longitude', date: `${dateText} ${zone}` };
}

let stampMapCanvas = null;
let stampMapUrl = null;
const OSM_TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function tileCoordinates(latitude, longitude, zoom) {
  const scale = 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const latitudeRadians = lat * Math.PI / 180;
  const x = (longitude + 180) / 360 * scale;
  const y = (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * scale;
  return { x, y, tileX: Math.floor(x), tileY: Math.floor(y), scale };
}

async function loadLocationMap(latitude, longitude) {
  const zoom = 14;
  const point = tileCoordinates(latitude, longitude, zoom);
  const startX = point.tileX - 1; const startY = point.tileY - 1;
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = 512; mapCanvas.height = 512;
  const context = mapCanvas.getContext('2d');
  const bitmaps = [];
  try {
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      const tileX = ((startX + column) % point.scale + point.scale) % point.scale;
      const tileY = Math.max(0, Math.min(point.scale - 1, startY + row));
      const url = OSM_TILE_TEMPLATE.replace('{z}', String(zoom)).replace('{x}', String(tileX)).replace('{y}', String(tileY));
      const response = await fetch(url);
      if (!response.ok) throw new Error('The map provider could not load the location map.');
      const bitmap = await createImageBitmap(await response.blob());
      bitmaps.push(bitmap);
      context.drawImage(bitmap, column * 256, row * 256, 256, 256);
    }
    const pinX = (point.x - point.tileX + 1) * 256;
    const pinY = (point.y - point.tileY + 1) * 256;
    context.fillStyle = '#d84c43'; context.beginPath(); context.arc(pinX, pinY - 7, 9, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.moveTo(pinX - 6, pinY - 1); context.lineTo(pinX + 6, pinY - 1); context.lineTo(pinX, pinY + 10); context.closePath(); context.fill();
    context.fillStyle = 'white'; context.beginPath(); context.arc(pinX, pinY - 7, 3, 0, Math.PI * 2); context.fill();
    return mapCanvas;
  } catch (error) {
    mapCanvas.width = 0; mapCanvas.height = 0;
    throw error;
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

function releaseStampMap() {
  stampMapCanvas = null;
  if (stampMapUrl) URL.revokeObjectURL(stampMapUrl);
  stampMapUrl = null;
  $('#geo-stamp-map-preview').removeAttribute('src');
  $('#geo-stamp-map-preview').hidden = true;
  $('#geo-stamp-map-placeholder').hidden = false;
  $('#geo-stamp-preview').classList.remove('has-map');
}

function updateStampPreview() {
  const stamp = $('#geo-stamp-preview');
  const visible = $('#geo-print-stamp').checked && Boolean(sourceFile) && !resultUrl;
  stamp.hidden = !visible;
  stamp.className = `geo-stamp-preview ${$('#geo-position').value}`;
  const text = stampText();
  $('#geo-stamp-place').textContent = text.place;
  $('#geo-stamp-locality').textContent = text.address;
  $('#geo-stamp-locality').hidden = !text.address;
  $('#geo-stamp-address').textContent = text.coordinates;
  $('#geo-stamp-date').textContent = text.date;
  $('#geo-stamp-credit').textContent = stampMapUrl ? 'Location tagged with QuickKit · © OpenStreetMap contributors' : 'Map loads when you make the photo';
  stamp.classList.toggle('has-map', Boolean(stampMapUrl));
  if (stampMapUrl) { $('#geo-stamp-map-preview').src = stampMapUrl; $('#geo-stamp-map-preview').hidden = false; $('#geo-stamp-map-placeholder').hidden = true; }
}

function removeResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  $('#geo-result').hidden = true;
  $('#geo-download').removeAttribute('href');
  $('#geo-preview-badge').textContent = sourceFile ? 'Original photo' : 'No photo yet';
  $('#geo-preview-badge').classList.remove('is-ready');
  if (sourceUrl && imagePreview.src !== sourceUrl) imagePreview.src = sourceUrl;
  releaseStampMap();
  updateStampPreview();
}

async function loadPhoto(file) {
  if (!file || (!/^image\/(jpeg|png|webp)$/iu.test(file.type) && !/\.(jpe?g|png|webp)$/iu.test(file.name))) {
    setStatus('Choose a JPG, PNG or WebP photo.', true); return;
  }
  if (file.size > MAX_IMAGE_BYTES) { setStatus('This photo is larger than the 30 MB limit. Choose a smaller photo.', true); return; }
  if (cameraStream) {
    stopCamera();
    showCameraPanel(false);
    setCameraStatus('Camera closed because a saved photo was selected.');
  }
  const nextUrl = URL.createObjectURL(file);
  const probe = new Image();
  try {
    await new Promise((resolve, reject) => { probe.onload = resolve; probe.onerror = () => reject(new Error('This photo could not be opened by the browser.')); probe.src = nextUrl; });
    if (probe.naturalWidth * probe.naturalHeight > MAX_PIXELS) throw new Error('This photo is over the 24 megapixel limit. Resize a smaller copy first.');
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    removeResult();
    sourceFile = file; sourceUrl = nextUrl;
    sourceDimensions = { width: probe.naturalWidth, height: probe.naturalHeight };
    imagePreview.src = sourceUrl; imagePreview.hidden = false; $('#geo-preview-empty').hidden = true;
    $('#geo-preview-frame').style.setProperty('--geo-ratio', `${probe.naturalWidth} / ${probe.naturalHeight}`);
    $('#geo-upload-title').textContent = file.name;
    $('#geo-preview-caption').textContent = `${file.name} · ${probe.naturalWidth} × ${probe.naturalHeight} px`;
    $('#geo-preview-badge').textContent = 'Original photo';
    setStatus('Photo ready. Add the correct location before creating its GPS-tagged copy.');
    setReadyState();
  } catch (error) {
    URL.revokeObjectURL(nextUrl);
    setStatus(error?.message || 'This photo could not be opened.', true);
  }
}

function exifDate(date) {
  const part = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}:${part(date.getMonth() + 1)}:${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
}

function gpsDate(date) {
  return `${date.getUTCFullYear()}:${String(date.getUTCMonth() + 1).padStart(2, '0')}:${String(date.getUTCDate()).padStart(2, '0')}`;
}

function degreesToDmsRational(value) {
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  const totalMinutes = (absolute - degrees) * 60;
  let minutes = Math.floor(totalMinutes);
  let seconds = Math.round((totalMinutes - minutes) * 60 * 1_000_000);
  if (seconds >= 60_000_000) { seconds = 0; minutes++; }
  if (minutes >= 60) { minutes = 0; degrees++; }
  return [[degrees, 1], [minutes, 1], [seconds, 1_000_000]];
}

function verifyGps(piexif, dataUrl, coordinates) {
  const gps = piexif.load(dataUrl).GPS;
  if (!gps[piexif.GPSIFD.GPSLatitude] || !gps[piexif.GPSIFD.GPSLongitude]) return false;
  const latitude = piexif.GPSHelper.dmsRationalToDeg(gps[piexif.GPSIFD.GPSLatitude], gps[piexif.GPSIFD.GPSLatitudeRef]);
  const longitude = piexif.GPSHelper.dmsRationalToDeg(gps[piexif.GPSIFD.GPSLongitude], gps[piexif.GPSIFD.GPSLongitudeRef]);
  return gps[piexif.GPSIFD.GPSLatitudeRef] === (coordinates.latitude < 0 ? 'S' : 'N')
    && gps[piexif.GPSIFD.GPSLongitudeRef] === (coordinates.longitude < 0 ? 'W' : 'E')
    && Math.abs(latitude - coordinates.latitude) < 0.0000001
    && Math.abs(longitude - coordinates.longitude) < 0.0000001;
}

async function createGeoPhoto() {
  if (!sourceFile) return;
  const coordinates = currentCoordinates();
  if (!coordinates) { setReadyState(); setStatus('Add valid coordinates before creating the photo.', true); return; }
  const create = $('#geo-create'); create.disabled = true; create.textContent = 'Making your photo…';
  setStatus('Rendering the photo and writing its GPS metadata on this device…');
  let canvas; let stampMapUnavailable = false;
  try {
    piexifPromise ||= import('piexifjs');
    const imported = await piexifPromise;
    const piexif = imported.default || imported.piexif || imported;
    releaseStampMap();
    if ($('#geo-print-stamp').checked) {
      setStatus('Loading the nearby OpenStreetMap tiles for your photo card…');
      try {
        stampMapCanvas = await loadLocationMap(coordinates.latitude, coordinates.longitude);
        const mapBlob = await new Promise((resolve, reject) => stampMapCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Map image could not be prepared.')), 'image/png'));
        stampMapUrl = URL.createObjectURL(mapBlob);
        updateStampPreview();
      } catch {
        stampMapUnavailable = true;
      }
    }
    canvas = document.createElement('canvas');
    canvas.width = sourceDimensions.width; canvas.height = sourceDimensions.height;
    const sourceImage = new Image(); sourceImage.src = sourceUrl;
    if (sourceImage.decode) await sourceImage.decode();
    else await new Promise((resolve, reject) => { sourceImage.onload = resolve; sourceImage.onerror = reject; });
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('This browser cannot create an image canvas. Try an updated browser.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
    if ($('#geo-print-stamp').checked) {
      const scale = Math.max(.8, canvas.width / 1100);
      const padding = Math.round(13 * scale);
      const boxWidth = Math.min(canvas.width - padding * 2, Math.max(220 * scale, canvas.width * .72));
      const boxHeight = Math.min(canvas.height - padding * 2, Math.max(78 * scale, Math.min(canvas.height * .34, 190 * scale)));
      const mapWidth = Math.min(boxHeight * 1.05, boxWidth * .36);
      const text = stampText();
      const corner = $('#geo-position').value;
      const x = corner.endsWith('right') ? canvas.width - boxWidth - padding : padding;
      const y = corner.startsWith('bottom') ? canvas.height - boxHeight - padding : padding;
      context.fillStyle = 'rgba(8, 17, 27, 0.86)';
      context.beginPath();
      if (context.roundRect) context.roundRect(x, y, boxWidth, boxHeight, Math.round(10 * scale));
      else context.rect(x, y, boxWidth, boxHeight);
      context.fill();
      if (stampMapCanvas) {
        context.save();
        if (context.roundRect) { context.beginPath(); context.roundRect(x + padding, y + padding, mapWidth, boxHeight - padding * 2, Math.round(7 * scale)); context.clip(); }
        context.drawImage(stampMapCanvas, x + padding, y + padding, mapWidth, boxHeight - padding * 2);
        context.restore();
      } else {
        context.fillStyle = '#dfe8ef'; context.fillRect(x + padding, y + padding, mapWidth, boxHeight - padding * 2);
        context.fillStyle = '#39516a'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = `600 ${Math.max(9, Math.round(11 * scale))}px Arial, sans-serif`;
        context.fillText('Map unavailable', x + padding + mapWidth / 2, y + boxHeight / 2, mapWidth - 8);
      }
      const copyX = x + padding * 2 + mapWidth;
      const copyWidth = boxWidth - (copyX - x) - padding;
      context.textAlign = 'left'; context.textBaseline = 'top';
      context.fillStyle = '#fff'; context.font = `700 ${Math.max(12, Math.round(18 * scale))}px Arial, sans-serif`;
      context.fillText(text.place, copyX, y + padding, copyWidth);
      context.fillStyle = '#eff4f8'; context.font = `500 ${Math.max(10, Math.round(13 * scale))}px Arial, sans-serif`;
      const detailOffset = text.address ? 18 : 0;
      if (text.address) {
        context.font = `500 ${Math.max(9, Math.round(11 * scale))}px Arial, sans-serif`;
        context.fillText(text.address, copyX, y + padding + Math.round(22 * scale), copyWidth);
        context.font = `500 ${Math.max(10, Math.round(13 * scale))}px Arial, sans-serif`;
      }
      context.fillText(text.coordinates, copyX, y + padding + Math.round(27 * scale) + Math.round(detailOffset * scale), copyWidth);
      context.fillText(text.date, copyX, y + padding + Math.round(48 * scale) + Math.round(detailOffset * scale), copyWidth);
      context.fillStyle = '#cbd8e4'; context.font = `500 ${Math.max(8, Math.round(10 * scale))}px Arial, sans-serif`;
      context.fillText('Location tagged with QuickKit', copyX, y + boxHeight - padding - Math.round(22 * scale), copyWidth);
      context.textAlign = 'right';
      if (stampMapCanvas) context.fillText('© OpenStreetMap contributors', x + boxWidth - padding, y + boxHeight - padding - Math.round(8 * scale), copyWidth);
    }

    const jpegData = canvas.toDataURL('image/jpeg', 0.92);
    const metadata = (() => { try { return piexif.load(jpegData); } catch { return { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null }; } })();
    const gps = metadata.GPS || {};
    const date = dateValue();
    gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
    gps[piexif.GPSIFD.GPSLatitudeRef] = coordinates.latitude < 0 ? 'S' : 'N';
    gps[piexif.GPSIFD.GPSLatitude] = degreesToDmsRational(coordinates.latitude);
    gps[piexif.GPSIFD.GPSLongitudeRef] = coordinates.longitude < 0 ? 'W' : 'E';
    gps[piexif.GPSIFD.GPSLongitude] = degreesToDmsRational(coordinates.longitude);
    gps[piexif.GPSIFD.GPSDateStamp] = gpsDate(date);
    gps[piexif.GPSIFD.GPSTimeStamp] = [[date.getUTCHours(), 1], [date.getUTCMinutes(), 1], [date.getUTCSeconds(), 1]];
    metadata['0th'][piexif.ImageIFD.Software] = 'QuickKit Geo Photo';
    metadata['0th'][piexif.ImageIFD.DateTime] = exifDate(date);
    metadata.Exif = metadata.Exif || {};
    metadata.Exif[piexif.ExifIFD.DateTimeOriginal] = exifDate(date);
    metadata.GPS = gps;
    const taggedData = piexif.insert(piexif.dump(metadata), jpegData);
    if (!verifyGps(piexif, taggedData, coordinates)) throw new Error('GPS metadata did not pass its read-back check. No download was created.');
    const response = await fetch(taggedData);
    const blob = await response.blob();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    imagePreview.src = resultUrl;
    $('#geo-download').href = resultUrl;
    const baseName = sourceFile.name.replace(/\.[^.]+$/u, '').replace(/[\\/:*?"<>|]+/gu, '-').slice(0, 80) || 'photo';
    $('#geo-download').download = `${baseName}-geo-tagged.jpg`;
    $('#geo-result-details').textContent = `${blob.size < 1024 * 1024 ? `${Math.round(blob.size / 1024)} KB` : `${(blob.size / 1048576).toFixed(1)} MB`} · ${sourceDimensions.width} × ${sourceDimensions.height} px · GPS metadata verified`;
    $('#geo-result').hidden = false;
    $('#geo-preview-badge').textContent = 'GPS metadata verified';
    $('#geo-preview-badge').classList.add('is-ready');
    $('#geo-preview-caption').textContent = `${sourceDimensions.width} × ${sourceDimensions.height} px · Tagged JPEG`;
    setStatus(stampMapUnavailable
      ? 'GPS metadata is verified. The map service is unavailable right now, so the card shows a placeholder with the place, coordinates and time.'
      : 'GPS coordinates were written and read back successfully. Preview the photo and download when ready.');
  } catch (error) {
    setStatus(error?.message || 'The browser could not create this geo-tagged image.', true);
  } finally {
    canvas?.remove(); create.textContent = 'Make geo-tagged photo'; setReadyState();
  }
}

function requestCurrentLocation() {
  if (!navigator.geolocation) { setLocationStatus('This browser does not offer location access. Enter coordinates manually.', true); return Promise.resolve(false); }
  const button = $('#geo-use-current'); button.disabled = true; button.textContent = 'Waiting for location permission…';
  setLocationStatus('Waiting for your browser to confirm location access…');
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(async (position) => {
    clearAutoPlaceLabel();
    $('#geo-latitude').value = position.coords.latitude.toFixed(7);
    $('#geo-longitude').value = position.coords.longitude.toFixed(7);
    setReadyState(); setStatus('Current coordinates added. Check them before making the photo.');
    button.disabled = false; button.textContent = 'Refresh current location';
    await reverseLookupPlace();
    resolve(true);
  }, (error) => {
    const reason = error.code === 1
      ? 'Location access was blocked. Allow it in the browser or choose a point on the map or enter coordinates.'
      : error.code === 2
        ? 'Your device allowed location access but could not determine a position. Turn on device Location Services and Wi-Fi/GPS, or choose a point on the map or enter coordinates.'
        : 'The location request timed out. Your device did not return a fix. Check Location Services and Wi-Fi/GPS, then retry, choose a point on the map, or enter coordinates.';
    setLocationStatus(reason, true); button.disabled = false; button.textContent = 'Try current location again';
    resolve(false);
  }, { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 }));
}

function clearAll() {
  stopCamera();
  showCameraPanel(false);
  setCameraStatus('Camera is off. Choose Use camera to show the live preview.');
  hideMap();
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  sourceFile = null; sourceUrl = null; resultUrl = null; sourceDimensions = null; fileInput.value = '';
  imagePreview.removeAttribute('src'); imagePreview.hidden = true;
  $('#geo-preview-empty').hidden = false; $('#geo-result').hidden = true; $('#geo-create').disabled = true;
  $('#geo-upload-title').textContent = 'Choose a photo or drop it here';
  $('#geo-preview-caption').textContent = 'Your selected photo appears here.';
  $('#geo-preview-badge').textContent = 'No photo yet'; $('#geo-preview-badge').classList.remove('is-ready');
  $('#geo-preview-frame').style.setProperty('--geo-ratio', '1.5'); $('#geo-stamp-preview').hidden = true;
  $('#geo-latitude').value = ''; $('#geo-longitude').value = ''; $('#geo-place').value = '';
  $('#geo-date').value = dateForInput();
  autoPlaceLabel = false; autoPlaceDetails = ''; $('#geo-place-query').value = ''; $('#geo-map-results').replaceChildren(); $('#geo-map-results').hidden = true;
  setPlaceStatus('Enter coordinates or pick a place on the map first.'); setMapSearchStatus('Search is sent to OpenStreetMap only when you press Search map.');
  if (mapInstance) mapInstance.setView([20, 0], 2);
  setStatus('Choose a photo and add its location.'); setReadyState();
}

fileInput.addEventListener('change', (event) => { const file = event.currentTarget.files[0]; event.currentTarget.value = ''; if (file) loadPhoto(file); });
$('#geo-use-current').addEventListener('click', requestCurrentLocation);
$('#geo-create').addEventListener('click', createGeoPhoto);
$('#geo-clear').addEventListener('click', clearAll);
$('#geo-camera-open').addEventListener('click', () => openCamera());
$('#geo-camera-close').addEventListener('click', closeCamera);
$('#geo-camera-capture').addEventListener('click', capturePhoto);
$('#geo-camera-tag-location').addEventListener('click', () => capturePhoto({ tagCurrentLocation: true }));
$('#geo-camera-flip').addEventListener('click', flipCamera);
$('#geo-camera-device').addEventListener('change', (event) => { if (event.currentTarget.value) openCamera(event.currentTarget.value); });
$('#geo-map-open').addEventListener('click', () => { if ($('#geo-map-panel').hidden) showMap(); else hideMap(); });
$('#geo-map-close').addEventListener('click', hideMap);
$('#geo-place-search').addEventListener('click', searchPlaces);
$('#geo-place-query').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); searchPlaces(); } });
$('#geo-reverse-lookup').addEventListener('click', reverseLookupPlace);
['#geo-latitude', '#geo-longitude'].forEach((selector) => $(selector).addEventListener('input', () => { clearAutoPlaceLabel(); removeResult(); setReadyState(); }));
$('#geo-place').addEventListener('input', () => { autoPlaceLabel = false; autoPlaceDetails = ''; removeResult(); updateStampPreview(); });
['#geo-date', '#geo-position', '#geo-print-stamp'].forEach((selector) => $(selector).addEventListener('input', () => { removeResult(); updateStampPreview(); }));
$('#geo-position').addEventListener('change', () => { removeResult(); updateStampPreview(); });
window.addEventListener('pagehide', stopCamera);
const dropzone = $('#geo-dropzone');
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); if (event.dataTransfer.files[0]) loadPhoto(event.dataTransfer.files[0]); });

$('#geo-date').value = dateForInput();
setReadyState();
