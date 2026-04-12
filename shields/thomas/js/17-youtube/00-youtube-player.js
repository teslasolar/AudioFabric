// ═══ YOUTUBE PLAYER ═══
// Called automatically by YouTube IFrame API when ready
var channelLoaded = false;
var channelId = null; // discovered from playing videos
var CHANNEL_HANDLE = 'ThomasTheSolarCryptoEngine';
var titleFetchQueue = [];
var titleFetchBusy = false;

