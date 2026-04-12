// ═══ LAUNCH ═══
document.getElementById('boot-enter').addEventListener('click', enterFold);
runBoot().catch(function(err){console.error('Boot failed:',err);});
