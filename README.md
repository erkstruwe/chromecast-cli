# chromecast-cli

Command line interface for Google Chromecast

## Installation

```
npm install -g chromecast-cli
```

## Usage

Type the following to get a list of all commands and options:

```
chromecast
```

```
Usage: chromecast-cli [options] [command]

Options:
  -V, --version                output the version number
  -H, --host <host>            IP address or hostname of Chromecast (required)
  -h, --help                   output usage information

Commands:
  play [options] <src...>      Play file(s) at <src>
  volume <volume>              Set the volume to <volume>
  volumeStepUp <volumeStep>    Set the volume <volumeStep> higher
  volumeStepDown <volumeStep>  Set the volume <volumeStep> lower
  mute                         Mute
  unmute                       Unmute
  stop                         Stop playback
  pause                        Pause playback
  unpause                      Unpause playback
  status                       Get Chromecast status
  sessions                     Get current playback sessions
  sessionDetails               Get current playback session details (e. g. title, application, image URLs, etc.) of first session
```

Please note that this tool does not discover Chromecast devices on your network for performance reasons. You have to specify an IP address via the `--host` option. Consider configuring your DHCP server to assign a fixed IP address to your Chromecast devices.

### Examples

The IP address 192.168.1.100 is just an example. Use the IP address of your Chromecast device instead.

Display the device status as JSON

```
chromecast --host 192.168.1.100 status
```

Play a song from a DLNA/UPnP source at IP address 192.168.1.1 (e. g. a router or a NAS)

```
chromecast --host 192.168.1.100 play http://192.168.1.1/media/song.mp3
```

Play a Youtube video (courtesy of [youtube-dl](https://www.npmjs.com/package/youtube-dl) package)

```
chromecast --host 192.168.1.100 play $(youtube-dl --format bestaudio --get-url "https://youtu.be/dQw4w9WgXcQ")
```

## Changelog

- Version 1 required a Node.js version of at least 5. Version 2 requires a Node.js version of at least 8.
