
function activateMode(name) {
  var modeName = name.toUpperCase().replace(/\s+/g, '_');
  if (SHIELD_MODES[modeName]) {
    setShieldMode(modeName);
  }
}

