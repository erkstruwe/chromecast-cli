#!/usr/bin/env node

var app = require('commander');
var async = require('async');
var lodash = require('lodash');
var Client = require('castv2-client').Client;
var Receiver = require('castv2-client').DefaultMediaReceiver;

var connect = function (host, cb) {
    var client = new Client();
    client.on('error', function (e) {
        console.error('Client error', e);
        client.close();
    });
    client.on('message', function (message) {
        console.log('Client message', message);
    });
    client.on('close', function () {
        console.error('Client closed');
    });

    return client.connect(host, function () {
        return cb(null, client);
    });
};

app
    .version(process.env.npm_package_version)
    .option('-H, --host <host>', 'IP address or hostname of Chromecast (required)');

app
    .command('play <src...>')
    .description('Play file(s) at <src>')
    // TODO .option('-r, --repeat-mode <repeat-mode>', 'Set repeat mode (REPEAT_OFF, REPEAT_ONE or REPEAT_ALL)', /^(REPEAT_OFF|REPEAT_ONE|REPEAT_ALL)$/i, 'REPEAT_OFF')
    .option('-i, --no-interrupt', 'Do not interrupt if already casting')
    .action(function (src, options) {
        if (!app.host)
            throw new Error('--host option is required');

        var lastStarted = null;
        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            status: ['client', function (r, cb) {
                return r.client.receiver.getStatus(cb);
            }],
            receiver: ['client', 'status', function (r, cb) {
                if (!options.interrupt && lodash.get(r.status, 'applications.0'))
                    return cb(new Error('Already casting. Aborting due to the use of --no-interrupt option.'));
                return r.client.launch(Receiver, cb);
            }],
            receiverEvents: ['receiver', function (r, cb) {
                r.receiver.on('close', function () {
                    return cb(new Error('Receiver was closed'));
                });
                return cb();
            }],
            playlist: ['receiver', 'receiverEvents', function (r, cb) {
                var play = function (file) {
                    if (!file)
                        return cb();

                    var media = {
                        contentId: file
                    };

                    console.log('Playing', file);
                    return r.receiver.load(media, {autoplay: true, repeatMode: options.repeatMode}, function (e, r) {
                        if (e)
                            return cb(e);
                    });
                };

                r.receiver.on('status', function (status) {
                    console.log('Status', status.playerState);
                    switch (status.playerState) {
                        case 'IDLE':
                            return play(src.shift());
                    }
                });

                return play(src.shift());
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            return process.exit();
        });
    });

app
    .command('volume <volume>')
    .description('Set the volume to <volume>')
    .action(function (volume) {
        if (!app.host)
            throw new Error('--host option is required');

        volume = parseFloat(volume);
        if (!volume)
            throw new Error('Invalid volume parameter. Has to be float between 0.0 and 1.0.');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            volume: ['client', function (r, cb) {
                r.client.receiver.setVolume({level: volume, muted: false}, cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            console.log(r.volume);
            return process.exit();
        });
    });

app
    .command('volumeStepUp <volumeStep>')
    .description('Set the volume <volumeStep> higher')
    .action(function (volumeStep) {
        if (!app.host)
            throw new Error('--host option is required');

        volumeStep = parseFloat(volumeStep);
        if (!volumeStep)
            throw new Error('Invalid volumeStep parameter. Has to be float between 0.0 and 1.0.');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            oldVolume: ['client', function (r, cb) {
                r.client.receiver.getVolume(cb);
            }],
            newVolume: ['client', 'oldVolume', function (r, cb) {
                var volume = r.oldVolume.level;
                volume += volumeStep;
                volume = volume > 1 ? 1 : volume;
                r.client.receiver.setVolume({level: volume, muted: false}, cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            console.log(r.newVolume);
            return process.exit();
        });
    });

app
    .command('volumeStepDown <volumeStep>')
    .description('Set the volume <volumeStep> lower')
    .action(function (volumeStep) {
        if (!app.host)
            throw new Error('--host option is required');

        volumeStep = parseFloat(volumeStep);
        if (!volumeStep)
            throw new Error('Invalid volumeStep parameter. Has to be float between 0.0 and 1.0.');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            oldVolume: ['client', function (r, cb) {
                r.client.receiver.getVolume(cb);
            }],
            newVolume: ['client', 'oldVolume', function (r, cb) {
                var volume = r.oldVolume.level;
                volume -= volumeStep;
                volume = volume < 0 ? 0 : volume;
                r.client.receiver.setVolume({level: volume, muted: false}, cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            console.log(r.newVolume);
            return process.exit();
        });
    });

app
    .command('mute')
    .description('Mute')
    .action(function () {
        if (!app.host)
            throw new Error('--host option is required');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            volume: ['client', function (r, cb) {
                r.client.receiver.setVolume({muted: true}, cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            console.log(r.volume);
            return process.exit();
        });
    });

app
    .command('unmute')
    .description('Unmute')
    .action(function () {
        if (!app.host)
            throw new Error('--host option is required');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            volume: ['client', function (r, cb) {
                r.client.receiver.setVolume({muted: false}, cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            console.log(r.volume);
            return process.exit();
        });
    });

app
    .command('stop')
    .description('Stop playback')
    .action(function () {
        if (!app.host)
            throw new Error('--host option is required');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            stop: ['client', function (r, cb) {
                return r.client.receiver.stop(null, cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            return process.exit();
        });
    });

app
    .command('status')
    .description('Get Chromecast status')
    .action(function () {
        if (!app.host)
            throw new Error('--host option is required');

        return async.auto({
            client: function (cb) {
                return connect(app.host, cb);
            },
            status: ['client', function (r, cb) {
                return r.client.receiver.getStatus(cb);
            }]
        }, function (e, r) {
            if (e) {
                console.error(e);
                return process.exit(1);
            }
            console.log(r.status);
            return process.exit();
        });
    });

app
    .parse(process.argv);

if (!process.argv.slice(2).length) {
    app.help();
}
