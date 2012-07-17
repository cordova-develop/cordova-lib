var cordova_util = require('./util'),
    path = require('path'),
    exec = require('child_process').exec,
    config_parser = require('./config_parser'),
    fs = require('fs'),
    util = require('util');

module.exports = function build () {
    var projectRoot = cordova_util.isCordova(process.cwd());

    if (!projectRoot) {
        console.error('Current working directory is not a Cordova-based project.');
        return;
    }

    var xml = path.join(projectRoot, 'www', 'config.xml');
    var cfg = new config_parser(xml);
    var platforms = cfg.ls_platforms();

    // Iterate over each added platform and shell out to debug command
    platforms.map(function(platform) {
        var cmd = path.join(projectRoot, 'platforms', platform, 'cordova', 'debug');
        exec(cmd, function(err, stderr, stdout) {
            if (err) 
                console.error('An error occurred while building the ' + platform + ' project.', err);
        });
    });
};
