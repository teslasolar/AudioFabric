
function finalizeChannelLoad() {
  var btn = document.getElementById('btn-load-channel');
  btn.textContent = playlist.length > 0 ?
    '\u2713 ' + playlist.length + ' VIDEOS LOADED' :
    '\u25b6 LOAD ALL CHANNEL VIDEOS';
  btn.disabled = false;
  channelLoaded = playlist.length > 0;

  var status = document.getElementById('channel-status');
  if (playlist.length > 0) {
    status.textContent = playlist.length + ' videos ready \u2014 click any to play';
  } else {
    status.textContent = 'no videos found \u2014 try adding URLs manually';
  }
}

