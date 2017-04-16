var dota2 = require('dota2'),
    clock = require('clockmaker'),
    Timer = clock.Timer;

var interval = 60 * 1000;

module.exports.name = 'dota-plugin';
module.exports.plugin = function(VaporAPI) {
    var log = VaporAPI.getLogger();
    VaporAPI.registerHandler({
      emitter: 'vapor',
      event: 'ready'
    }, function () {

      // "launch" dota
      Dota2.launch();
    });

    var Dota2 = new dota2.Dota2Client(VaporAPI.getClient());
    var statIds = dota2.schema.CMsgDOTAProfileCard.EStatID;

    // prepare stat mapping
    var statMapping = {};
    for (var stat in statIds) {
      if (statIds.hasOwnProperty(stat)) {
        statMapping[statIds[stat]] = stat;
      }
    }

    var config = VaporAPI.getConfig();
    var profileTimer = Timer(function (timer) {
      Object.keys(config.users).forEach(function (userid) {
        log.info('Requesting profile info for', userid);
        Dota2.requestProfileCard(Dota2.ToAccountID(userid));
      });
    }, interval, {repeat: true});

    Dota2.on('profileCardData', function (accountId, response) {
      var stats = {};

      response.slots.forEach(function (slot) {
        var stat = slot.stat;
        if (stat) {
          var statName = statMapping[stat.stat_id];
          var filename = Dota2.ToSteamID(accountId) + '-' + statName + '.txt';
          var content = String(stat.stat_score);

          VaporAPI.emitEvent('writeFile', filename, content, function (err) {
            console.log('Written profile info:', filename);
          });
        }
      });
    });

    Dota2.on('ready', function () {
      log.info('Dota2 GC ready');
      profileTimer.start();
    });

    Dota2.on('unready', function () {
      log.error('Dota2 GC disappeared');
      profileTimer.stop();
    });
};