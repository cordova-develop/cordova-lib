/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var cordova_util  = require('./util'),
    util          = require('util'),
    fs            = require('fs'),
    shell         = require('shelljs'),
    path          = require('path'),
    shell         = require('shelljs'),
    config_parser = require('./config_parser'),
    hooker        = require('./hooker'),
    plugin_parser = require('./plugin_parser'),
    ls            = fs.readdirSync,
    plugman       = require('plugman');

var parsers = {
    "android": require('./metadata/android_parser'),
    "ios": require('./metadata/ios_parser'),
    "blackberry": require('./metadata/blackberry_parser')
};

module.exports = function plugin(command, targets, callback) {
    var projectRoot = cordova_util.isCordova(process.cwd());

    if (!projectRoot) {
        throw new Error('Current working directory is not a Cordova-based project.');
    }
    if (arguments.length === 0) command = 'ls';

    var hooks = new hooker(projectRoot);

    // Grab config info for the project
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new config_parser(xml);
    var platforms = cordova_util.listPlatforms(projectRoot);

    // Massage plugin name(s) / path(s)
    var pluginPath, plugins, names = [];
    pluginPath = path.join(projectRoot, 'plugins');
    plugins = ls(pluginPath);
    if (targets) {
        if (!(targets instanceof Array)) targets = [targets];
        targets.forEach(function(target) {
            if (target[target.length - 1] == path.sep) {
                target = target.substring(0, target.length - 1);
            }

            var targetName = target.substr(target.lastIndexOf(path.sep) + 1);
            names.push(targetName);
        });
    }

    switch(command) {
        case 'ls':
        case 'list':
            // TODO awkward before+after hooks here
            hooks.fire('before_plugin_ls');
            hooks.fire('after_plugin_ls');
            if (plugins.length) {
                return plugins;
            } else return 'No plugins added. Use `cordova plugin add <plugin>`.';
            break;
        case 'add':
            targets.forEach(function(target, index) {
                hooks.fire('before_plugin_add');
                var pluginsDir = path.join(projectRoot, 'plugins');

                if (target[target.length - 1] == path.sep) {
                    target = target.substring(0, target.length - 1);
                }

                // Fetch the plugin first.
                plugman.fetch(target, pluginsDir, false);
                
                // Iterate over all platforms in the project and install the plugin.
                platforms.forEach(function(platform) {
                    var platformRoot = path.join(projectRoot, 'platforms', platform);
                    var parser = new parsers[platform](platformRoot);
                    plugman.install(platform, platformRoot,
                                    names[index], pluginsDir, {}, parser.staging_dir());
                });

                hooks.fire('after_plugin_add');
            });
            if (callback) callback();
            break;
        case 'rm':
        case 'remove':
            if (platforms.length === 0) {
                throw new Error('You need at least one platform added to your app. Use `cordova platform add <platform>`.');
            }
            targets.forEach(function(target, index) {
                var targetName = names[index];
                // Check if we have the plugin.
                if (plugins.indexOf(targetName) > -1) {
                    var targetPath = path.join(pluginPath, targetName);
                    hooks.fire('before_plugin_rm');
                    // Check if there is at least one match between plugin
                    // supported platforms and app platforms
                    var pluginXml = new plugin_parser(path.join(targetPath, 'plugin.xml'));
                    var intersection = pluginXml.platforms.filter(function(e) {
                        if (platforms.indexOf(e) == -1) return false;
                        else return true;
                    });

                    // Iterate over all the common platforms between the plugin
                    // and the app, and uninstall.
                    // If this is a web-only plugin with no platform tags, this step
                    // is not needed and we just --remove the plugin below.
                    intersection.forEach(function(platform) {
                        var platformRoot = path.join(projectRoot, 'platforms', platform);
                        var parser = new parsers[platform](platformRoot);
                        plugman.uninstall(platform, platformRoot, targetName, path.join(projectRoot, 'plugins'), {}, parser.staging_dir());
                    });

                    // Finally remove the plugin dir from plugins/
                    plugman.remove(targetName, path.join(projectRoot, 'plugins'));

                    hooks.fire('after_plugin_rm');
                } else {
                    throw new Error('Plugin "' + targetName + '" not added to project.');
                }
            });
            if (callback) callback();
            break;
        default:
            throw new Error('Unrecognized command "' + command + '". Use either `add`, `remove`, or `list`.');
    }
};