# chromecast-cli
Command line interface for Google Chromecast

## Installation
```
npm install -g chromecast-cli
```

## Usage
Type the following to get a list of all commands and options:
```
chromecast-cli
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

## Features
* Play multiple files/urls from command line
* Stop
* Mute
* Unmute
* Set volume
* Increase/decrease volume
* Display Chromecast status
