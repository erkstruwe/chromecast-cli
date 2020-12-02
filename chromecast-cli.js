#!/usr/bin/env node
const { promisify } = require("util");

var commander = require("commander");
var async = require("async");
var lodash = require("lodash");
var Client = require("castv2-client").Client;
var Receiver = require("castv2-client").DefaultMediaReceiver;

var connect = function (host, cb) {
    var client = new Client();
    client.on("error", function (e) {
        console.error("Client error", e);
        client.close();
    });
    client.on("message", function (message) {
        console.log("Client message", message);
    });
    client.on("close", function () {
        console.error("Client closed");
    });

    return client.connect(host, function () {
        return cb(null, client);
    });
};

class ClientService {
    constructor(client) {
        this.client = client;
    }

    static async create(host) {
        if (!host) {
            throw new Error("--host option is required");
        }

        const client = await this.getClient(host);
        return new this(client);
    }

    static async getClient(host) {
        return new Promise((resolve, reject) => {
            const client = new Client();
            client.on("error", (e) => {
                console.error("Client error", e);
                client.close();
                reject(e);
            });
            client.on("message", (message) => {
                console.warn("Client message", message);
            });
            client.on("close", () => {
                console.warn("Client closed");
            });
            return client.connect(host, () => {
                resolve(client);
            });
        });
    }

    async getStatus() {
        const getStatus = promisify(
            this.client.receiver.getStatus.bind(this.client.receiver)
        );
        const status = await getStatus();
        return status;
    }

    async getSessions() {
        const getSessions = promisify(
            this.client.receiver.getSessions.bind(this.client.receiver)
        );
        const sessions = await getSessions();
        return sessions;
    }

    async getApp(session) {
        if (!session) {
            const sessions = await this.getSessions();
            if (!sessions.length) {
                return null;
            }
            session = sessions[0];
        }

        const join = promisify(this.client.join.bind(this.client));
        const app = await join(session, Receiver);
        if (!app.media.currentSession) {
            const getStatus = promisify(app.getStatus.bind(app));
            await getStatus();
        }
        return app;
    }
}

commander
    .version(process.env.npm_package_version)
    .option(
        "-H, --host <host>",
        "IP address or hostname of Chromecast (required)"
    );

commander
    .command("play <src...>")
    .description("Play file(s) at <src>")
    // TODO .option('-r, --repeat-mode <repeat-mode>', 'Set repeat mode (REPEAT_OFF, REPEAT_ONE or REPEAT_ALL)', /^(REPEAT_OFF|REPEAT_ONE|REPEAT_ALL)$/i, 'REPEAT_OFF')
    .option("-i, --no-interrupt", "Do not interrupt if already casting")
    .action(function (src, options) {
        if (!commander.host) throw new Error("--host option is required");

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                status: [
                    "client",
                    function (r, cb) {
                        return r.client.receiver.getStatus(cb);
                    },
                ],
                receiver: [
                    "client",
                    "status",
                    function (r, cb) {
                        if (
                            !options.interrupt &&
                            lodash.get(r.status, "applications.0")
                        )
                            return cb(
                                new Error(
                                    "Already casting. Aborting due to the use of --no-interrupt option."
                                )
                            );
                        return r.client.launch(Receiver, cb);
                    },
                ],
                receiverEvents: [
                    "receiver",
                    function (r, cb) {
                        r.receiver.on("close", function () {
                            return cb(new Error("Receiver was closed"));
                        });
                        return cb();
                    },
                ],
                playlist: [
                    "receiver",
                    "receiverEvents",
                    function (r, cb) {
                        var play = function (file) {
                            if (!file) return cb();

                            var media = {
                                contentId: file,
                            };

                            console.log("Playing", file);
                            return r.receiver.load(
                                media,
                                {
                                    autoplay: true,
                                    repeatMode: options.repeatMode,
                                },
                                function (e, r) {
                                    if (e) return cb(e);
                                }
                            );
                        };

                        r.receiver.on("status", function (status) {
                            console.log("Status", status.playerState);
                            switch (status.playerState) {
                                case "IDLE":
                                    return play(src.shift());
                            }
                        });

                        return play(src.shift());
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                return process.exit();
            }
        );
    });

commander
    .command("volume <volume>")
    .description("Set the volume to <volume>")
    .action(function (volume) {
        if (!commander.host) throw new Error("--host option is required");

        volume = parseFloat(volume);
        if (!volume)
            throw new Error(
                "Invalid volume parameter. Has to be float between 0.0 and 1.0."
            );

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                volume: [
                    "client",
                    function (r, cb) {
                        r.client.receiver.setVolume(
                            { level: volume, muted: false },
                            cb
                        );
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                log(r.volume);
                return process.exit();
            }
        );
    });

commander
    .command("volumeStepUp <volumeStep>")
    .description("Set the volume <volumeStep> higher")
    .action(function (volumeStep) {
        if (!commander.host) throw new Error("--host option is required");

        volumeStep = parseFloat(volumeStep);
        if (!volumeStep)
            throw new Error(
                "Invalid volumeStep parameter. Has to be float between 0.0 and 1.0."
            );

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                oldVolume: [
                    "client",
                    function (r, cb) {
                        r.client.receiver.getVolume(cb);
                    },
                ],
                newVolume: [
                    "client",
                    "oldVolume",
                    function (r, cb) {
                        var volume = r.oldVolume.level;
                        volume += volumeStep;
                        volume = volume > 1 ? 1 : volume;
                        r.client.receiver.setVolume(
                            { level: volume, muted: false },
                            cb
                        );
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                log(r.newVolume);
                return process.exit();
            }
        );
    });

commander
    .command("volumeStepDown <volumeStep>")
    .description("Set the volume <volumeStep> lower")
    .action(function (volumeStep) {
        if (!commander.host) throw new Error("--host option is required");

        volumeStep = parseFloat(volumeStep);
        if (!volumeStep)
            throw new Error(
                "Invalid volumeStep parameter. Has to be float between 0.0 and 1.0."
            );

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                oldVolume: [
                    "client",
                    function (r, cb) {
                        r.client.receiver.getVolume(cb);
                    },
                ],
                newVolume: [
                    "client",
                    "oldVolume",
                    function (r, cb) {
                        var volume = r.oldVolume.level;
                        volume -= volumeStep;
                        volume = volume < 0 ? 0 : volume;
                        r.client.receiver.setVolume(
                            { level: volume, muted: false },
                            cb
                        );
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                log(r.newVolume);
                return process.exit();
            }
        );
    });

commander
    .command("mute")
    .description("Mute")
    .action(function () {
        if (!commander.host) throw new Error("--host option is required");

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                volume: [
                    "client",
                    function (r, cb) {
                        r.client.receiver.setVolume({ muted: true }, cb);
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                log(r.volume);
                return process.exit();
            }
        );
    });

commander
    .command("unmute")
    .description("Unmute")
    .action(function () {
        if (!commander.host) throw new Error("--host option is required");

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                volume: [
                    "client",
                    function (r, cb) {
                        r.client.receiver.setVolume({ muted: false }, cb);
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                log(r.volume);
                return process.exit();
            }
        );
    });

commander
    .command("stop")
    .description("Stop playback")
    .action(function () {
        if (!commander.host) throw new Error("--host option is required");

        return async.auto(
            {
                client: function (cb) {
                    return connect(commander.host, cb);
                },
                stop: [
                    "client",
                    function (r, cb) {
                        return r.client.receiver.stop(null, cb);
                    },
                ],
            },
            function (e, r) {
                if (e) {
                    console.error(e);
                    return process.exit(1);
                }
                return process.exit();
            }
        );
    });

commander
    .command("pause")
    .description("Pause playback")
    .action(async () => {
        try {
            const client = await ClientService.create(commander.host);
            const app = await client.getApp();
            if (!app) {
                console.warn("Nothing playing");
                return process.exit(0);
            }
            app.pause();
            return process.exit(0);
        } catch (error) {
            console.error(error);
            return process.exit(1);
        }
    });

commander
    .command("unpause")
    .description("Unpause playback")
    .action(async () => {
        try {
            const client = await ClientService.create(commander.host);
            const app = await client.getApp();
            if (!app) {
                console.warn("Nothing playing");
                return process.exit(0);
            }
            app.play();
            return process.exit(0);
        } catch (error) {
            console.error(error);
            return process.exit(1);
        }
    });

commander
    .command("status")
    .description("Get Chromecast status")
    .action(async () => {
        try {
            const client = await ClientService.create(commander.host);
            const status = await client.getStatus();
            log(status);
        } catch (error) {
            console.error(error);
            return process.exit(1);
        }
        return process.exit(0);
    });

commander
    .command("sessions")
    .description("Get current playback sessions")
    .action(async () => {
        try {
            const client = await ClientService.create(commander.host);
            const sessions = await client.getSessions();
            log(sessions);
        } catch (error) {
            console.error(error);
            return process.exit(1);
        }
        return process.exit(0);
    });

commander
    .command("sessionDetails")
    .description("Get current playback session details (e. g. title, application, image URLs, etc.) of first session")
    .action(async () => {
        try {
            const client = await ClientService.create(commander.host);
            const app = await client.getApp();
            if (!app) {
                console.warn("No session");
                return process.exit(0);
            }
            log(app.media.currentSession);
            return process.exit(0);
        } catch (error) {
            console.error(error);
            return process.exit(1);
        }
    });

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
    commander.help();
}

function log(value) {
    console.log(JSON.stringify(value, undefined, 2));
}
