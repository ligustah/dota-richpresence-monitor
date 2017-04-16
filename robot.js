var robot = require('robotjs'),
  async = require('async');

var keys = [];

for(var i = 1; i <= 12; i++) {
  keys.push('f' + i);
}

var modifiers = ['control'];

function doTap(key, modifiers) {
  robot.keyTap(key, modifiers);
}

function doToggle(key, modifiers) {
  robot.keyToggle(key, 'down', modifiers);
  robot.keyToggle(key, 'up', modifiers);
}

async.eachSeries(keys, function(key, callback) {
  setTimeout(function() {
    console.log('tapping', modifiers, key);
    doToggle(key, modifiers);
    callback();
  }, 2000);
});
