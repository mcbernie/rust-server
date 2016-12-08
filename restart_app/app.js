#!/usr/bin/env node

// TODO: Wait for client update, or 30 minutes, whichever comes first

var request = require('request');
var isRestarting = false;
var now = Math.floor(new Date() / 1000);
var timeout = 1000 * 60 * 30;
var updateCheckInterval = 1000 * 60 * 5;
var debug = false;

if (debug)
{
	timeout = 1000 * 60;
}

// Check for updates every 5 minutes
checkForClientUpdate();
setTimeout(function()
{
	console.log("Checking if a client update is available..");
	checkForClientUpdate();
}, updateCheckInterval);

// Timeout after 30 minutes and restart
setTimeout(function()
{
	console.log("Timeout exceeded, forcing a restart");
	restart();
}, timeout);

function checkForClientUpdate()
{
	if (isRestarting) return;
	request({ url: 'https://whenisupdate.com/api.json', headers: { Referer: 'rust-docker-server' } }, function(error, response, body)
	{
		if (!error && response.statusCode == 200)
		{
		    var info = JSON.parse(body);
		    var latest = info.latest;
		    if (latest !== undefined && latest.length > 0)
		    {
		    	if (latest >= now)
		    	{
		    		console.log("Client update is out, forcing a restart");
		    		restart();
		    		return;
		    	}
		    }
	  	}
	  	if (!isRestarting) checkForClientUpdate();
	});
}

function restart()
{
	if (isRestarting) return;
	isRestarting = true;

	var serverHostname = 'localhost';
	var serverPort = process.env.RUST_RCON_PORT;
	var serverPassword = process.env.RUST_RCON_PASSWORD;

	var WebSocket = require('ws');
	var ws = new WebSocket("ws://" + serverHostname + ":" + serverPort + "/" + serverPassword);
	ws.on('open', function open()
	{
		setTimeout(function()
		{
			ws.send(createPacket("say NOTICE: We're updating the server in 5 minutes, so get to a safe spot!"));
			setTimeout(function()
			{
				ws.send(createPacket("global.kickall (Updating/Restarting)"));
				setTimeout(function()
				{
					ws.send(createPacket("quit"));
					//ws.send(createPacket("restart 60")); // NOTE: Don't use restart, because that doesn't actually restart the container!
					setTimeout(function()
					{
						ws.close(1000);

						// After 2 minutes, if the server's still running, forcibly shut it down
						setTimeout(function()
						{
							var child_process = require('child_process');
							child_process.execSync('kill -s 2 $(pidof bash)');
						}, 1000 * 60 * 2);
					}, 1000);
				}, 1000);
			}, 1000 * 60 * 5);
		}, 1000);
	});
}

function createPacket(command)
{
	var packet =
	{
		Identifier: -1,
		Message: command,
		Name: "WebRcon"
	};
	return JSON.stringify(packet);
}
