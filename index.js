"use strict";
const request = require('request');
const cheerio = require('cheerio');
const async = require('async');

var baseURL = "https://discord.statuspage.io";

function getIncidents() {
    return new Promise(function(resolve, reject) {
        console.log('Get Incidents');
        request.get(baseURL + "/history", function(err, res, body) {
            try {
                var $ = cheerio.load(body);
                var incidents = [];
                $('.incident-title').each(function() {
                    var elem = $(this);
                    incidents.push({
                        title: elem.text(),
                        id: elem.attr('href').match(/incidents\/(.*)/)[1]
                    });
                });

                return resolve(incidents);
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
    });
}

function trackIncident(id, callback) {
    var lastTimestamp = null;
    var resolved = false;
    async.until(() => resolved, function(cb) {
        console.log('Fetch incident: ' + id);
        request.get(baseURL + '/incidents/' + id, function(err, res, body) {
            try {
                var $ = cheerio.load(body);
                var incident = {
                    name: $('.incident-name').text().trim(),
                    impact: $('.incident-name').attr('class').match(/impact-(.*)/)[1],
                    updates: []
                };
                $('.update-row').each(function() {
                    var elem = $(this);
                    incident.updates.push({
                        title: elem.find('.update-title').text().trim(),
                        body: elem.find('.update-body').text().trim(),
                        timestamp: elem.find('.update-timestamp').text().trim(),
                    });
                });

                console.log('Incident', incident);

                if(incident.updates.length) {
                    if(incident.updates[0].title == 'Resolved') {
                        console.log('Incident is resolved');
                        resolved = true;
                    }

                    if(incident.updates[0].timestamp != lastTimestamp) {
                        if(lastTimestamp !== null) {
                            callback(incident);
                        }
                        lastTimestamp = incident.updates[0].timestamp;
                    }
                }

            } catch (e) {
                console.error(e);
            }

            setTimeout(cb, 5000);
        })
    });
}

function track(callback) {
    var lastIncident = null;
    async.whilst(() => true, function(cb) {
        getIncidents().then(function(incidents) {
            if(incidents[0].id != lastIncident) {
                lastIncident = incidents[0].id;
                console.log('Found new incident: ' + lastIncident);
                trackIncident(lastIncident, callback);
            }

            setTimeout(cb, 10000);
        }).catch(function() {
            setTimeout(cb, 5000);
        })
    });
}

var url = // your url;

track(function(incident) {
    var updates = "";
    incident.updates.forEach(function(v) {
        updates += `**${v.title}**: ${v.body}\n_${v.timestamp}_\n\n`;
    });
    request.post({
        url: url,
        json: {
            content: `**Incident: _${incident.name}_ [${incident.impact.toUpperCase()}]**\n\n${updates}`
        }
    }, function(err, res, body) {
        console.log('Sent message');
    });
})
