var vapor = require('vapor');
var vdf = require('./vdf.js');
var robot = require('robotjs');
var parser = require('./protobuf-textformat');
var config = require('config');
var dota2 = require('dota2');
var util = require('util');

var interval = 5000;

function myTap(binding) {
  if(binding !== undefined) {
    if(util.isString(binding) && binding.trim().length > 0) {
      robot.keyTap(binding);
    } else if (util.isArray(binding) && binding.length > 0) {
      var modifiers = binding.slice();
      var key = modifiers.splice(-1, 1)[0];
      robot.keyToggle(key, 'down', modifiers);
      robot.keyToggle(key, 'up', modifiers);
    }
  }
}

function newUser(user) {
  return {
    id: user.id,
    timeout: undefined,
    binds: user.binds,
    presence: {}
  }
}

var trackUsers = {};

config.users.forEach(function(user) {
  trackUsers[user.id] = newUser(user);
});

// Create bot instance
var bot = vapor();

// Initialize bot with our config
bot.init({
  username: config.steam.username,
  password: config.steam.password,
  displayName: config.steam.displayName,
  users: trackUsers
});

// Use console-logger so there's actually some output
// We load this plugin as soon as possible so it can start logging ASAP
bot.use(vapor.plugins.consoleLogger);

bot.use(vapor.plugins.fs);
bot.use(vapor.plugins.declineFriendRequests);
bot.use(vapor.plugins.essentials);
bot.use(vapor.plugins.accountFlags);
bot.use(require('./dota-plugin.js'));

bot.use({
  name: 'dota-status',
  plugin: function(VaporAPI) {
    var log = VaporAPI.getLogger();
    var Steam = VaporAPI.getSteam();
    var steamFriends = VaporAPI.getHandler('steamFriends');
    var dotaBuf = Steam.GC.Dota.Internal;
    var partyBuf = dotaBuf.CMsgDOTAPartyRichPresence;
    var statIds = dota2.schema.CMsgDOTAProfileCard.EStatID;

    var statMapping = {};
    for(var stat in statIds) {
      if(statIds.hasOwnProperty(stat)) {
        statMapping[statIds[stat]] = stat;
      }
    }

    var dotaRichPresence = new Steam.SteamRichPresence(VaporAPI.getClient(), 570);
    var Dota2 = new dota2.Dota2Client(VaporAPI.getClient(), true);
    var presenceTimeout = {};

    /*
     VaporAPI.registerHandler({
     emitter: 'steamFriends',
     event: 'relationships'
     }, function() {
     var friends = steamFriends.friends;
     log.info('Requesting friend data for', Object.keys(friends));
     steamFriends.requestFriendData(Object.keys(friends));
     });
     */

    /*
     "DOTA_RP_INIT"						"Main Menu"
     "DOTA_RP_IDLE"						"Main Menu (Idle)"
     "DOTA_RP_WAIT_FOR_PLAYERS_TO_LOAD"	"Waiting for loaders"
     "DOTA_RP_HERO_SELECTION"			"Hero Selection"
     "DOTA_RP_STRATEGY_TIME"				"Strategy Time"
     "DOTA_RP_PRE_GAME"					"Pre Game"
     "DOTA_RP_GAME_IN_PROGRESS"			"Playing A Game"
     "DOTA_RP_GAME_IN_PROGRESS_CUSTOM"	"Playing %s1"
     "DOTA_RP_GAME_IN_PROGRESS_CUSTOM_UNNAMED"	"Playing Custom Game"
     "DOTA_RP_LOBBY_CUSTOM"				"%s1 Lobby"
     "DOTA_RP_LOBBY_CUSTOM_UNNAMED"		"Custom Game Lobby"
     "DOTA_RP_PLAYING_AS"				"as %s2 (Lvl %s1)"
     "DOTA_RP_POST_GAME"					"Post Game"
     "DOTA_RP_DISCONNECT"				"Disconnecting"
     "DOTA_RP_SPECTATING"				"Spectating A Game"
     "DOTA_RP_CASTING"					"Casting A Game"
     "DOTA_RP_WATCHING_REPLAY"			"Watching A Replay"
     "DOTA_RP_WATCHING_TOURNAMENT"		"Watching A Tournament Game"
     "DOTA_RP_WATCHING_TOURNAMENT_REPLAY" "Watching A Tournament Replay"
     "DOTA_RP_FINDING_MATCH"				"Finding A Match"
     "DOTA_RP_FINDING_YEAR_BEAST_BRAWL"	"Finding Year Beast Brawl"
     "DOTA_RP_SPECTATING_WHILE_FINDING"	"Finding A Match & Spectacting"
     "DOTA_RP_PENDING"					"Friend Request Pending"
     "DOTA_RP_ONLINE"					"Online"
     "DOTA_RP_BUSY"						"Busy"
     "DOTA_RP_AWAY"						"Away"
     "DOTA_RP_SNOOZE"					"Snooze"
     "DOTA_RP_LOOKING_TO_TRADE"			"Looking To Trade"
     "DOTA_RP_LOOKING_TO_PLAY"			"Looking To Play"
     "DOTA_RP_PLAYING_OTHER"				"Playing Other Game"
     "DOTA_RP_ACCOUNT_DISABLED"			"Matchmaking Disabled Temporarily"
     "DOTA_RP_QUEST"						"On A Training Mission"
     "DOTA_RP_BOTPRACTICE"				"Playing Against Bots"
     "DOTA_RP_TRAINING"					"On a Training Mission"
     "DOTA_RP_OPEN_SOLO"					"Looking for party members"
     "DOTA_RP_OPEN_PARTY"				"In party looking for members"
     "DOTA_RP_PLAYING_DOTA_S1"			"Playing Dota 2"
     "DOTA_RP_PLAYING_DOTA_S2"			"Playing Dota 2 - Reborn Beta"
     */
    function changeState(user, state) {
      log.info('Rich presence for %s: %s => %s', user.id, user.presence.status, state);
      log.info('Tapping', user.binds[state]);

      // attempt to hit our hotkey
      myTap(user.binds[state]);
    }

    dotaRichPresence.on('info', function (info) {

      info.rich_presence.forEach(function (presence) {
        var user = VaporAPI.getConfig().users[presence.steamid_user];

        if(user === undefined) {
          // we're not tracking this user
          log.error('Presence info for untracked user', JSON.stringify(info));
          return;
        }

        // VaporAPI.emitEvent('writeFile', 'presence-' + presence.steamid_user, presence.rich_presence_kv, function () {});
        var dotaInfo = vdf.decode(presence.rich_presence_kv);

        if(dotaInfo.RP === undefined) {
          //no rich presence info
          log.warn('Received empty rich presence');
          return;
        }

        //log.info(JSON.stringify(dotaInfo));

        // show a message if the state changed
        if(user.presence === undefined || user.presence.status !== dotaInfo.RP.status) {
          changeState(user, dotaInfo.RP.status);
        }

        // store new presence info
        user.presence = dotaInfo.RP;

        if(user.timeout !== undefined) {
          clearTimeout(user.timeout);
        }

        // request presence info at least once every 30 seconds
        user.timeout = setTimeout(function() {
          dotaRichPresence.request({
            steamid_request: presence.steamid_user
          });
        }, interval);
        /*
         if(dotaInfo.RP && dotaInfo.RP.party) {
         var result = parser.parse(partyBuf, dotaInfo.RP.party);
         if(result.status) {
         console.log(JSON.stringify(result.message));
         }
         }
         */
      });
    });

    VaporAPI.registerHandler({
      emitter: 'steamFriends',
      event: 'personaState'
    }, function (state) {
      var users = VaporAPI.getConfig().users;

      if (users[state.friendid]) {
        if (state.gameid === '570') {
          dotaRichPresence.request({
            steamid_request: state.friendid
          });
        } else {
          // stop polling for presence changes
          clearTimeout(users[state.friendid].timeout);
          users[state.friendid] = newUser(state.friendid);
        }
      }
    });
  }
});

// Use built-in plugin to easily enter SteamGuard code
bot.use(vapor.plugins.stdinSteamGuard);

// Start the bot
bot.connect();
