/* ==========================================================================
   TellentHR / KiwiHR API Client
   Fetches HR data through the PHP proxy (api/tellent.php)
   ========================================================================== */

var TellentAPI = (function() {
    'use strict';

    var BASE = 'api/tellent.php';
    var _available = null; // cached availability check

    /**
     * Internal fetch helper
     */
    function request(action, callback, params) {
        var url = BASE + '?action=' + encodeURIComponent(action);
        if (params) {
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                }
            }
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true;
        xhr.timeout = 20000;

        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    callback(null, data);
                } catch (e) {
                    callback('JSON parse error');
                }
            } else {
                try {
                    var err = JSON.parse(xhr.responseText);
                    callback(err.message || ('HTTP ' + xhr.status));
                } catch (e2) {
                    callback('HTTP ' + xhr.status);
                }
            }
        };

        xhr.onerror = function() {
            callback('Network error');
        };

        xhr.ontimeout = function() {
            callback('Request timeout');
        };

        xhr.send();
    }

    return {
        /**
         * Check if TellentHR API is configured and reachable.
         * Caches result for the session.
         * @param {function(boolean, object)} callback - (available, info)
         */
        isAvailable: function(callback) {
            if (_available !== null) {
                callback(_available.ok, _available);
                return;
            }

            request('status', function(err, data) {
                if (err || !data || !data.configured) {
                    _available = { ok: false, error: err || 'Not configured' };
                    callback(false, _available);
                    return;
                }
                _available = {
                    ok: true,
                    employeeCount: data.employeeCount || 0,
                };
                callback(true, _available);
            });
        },

        /**
         * Get employee list
         * @param {function(error, data)} callback
         */
        getEmployees: function(callback) {
            request('employees', function(err, data) {
                if (err) { callback(err); return; }
                var users = (data.data && data.data.users) ? data.data.users : { items: [], pageInfo: { count: 0 } };
                callback(null, {
                    employees: users.items || [],
                    count: users.pageInfo ? users.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            });
        },

        /**
         * Get absence/time-off data
         * @param {function(error, data)} callback
         */
        getAbsences: function(callback) {
            request('absences', function(err, data) {
                if (err) { callback(err); return; }
                var types = (data.data && data.data.timeOffTypes) ? data.data.timeOffTypes : { items: [] };
                callback(null, {
                    types: types.items || [],
                    cached: data._cached || false,
                });
            });
        },

        /**
         * Get projects from KiwiHR
         * @param {function(error, data)} callback
         */
        getProjects: function(callback) {
            request('projects', function(err, data) {
                if (err) { callback(err); return; }
                var projects = (data.data && data.data.projects) ? data.data.projects : { items: [], pageInfo: { count: 0 } };
                callback(null, {
                    projects: projects.items || [],
                    count: projects.pageInfo ? projects.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            });
        },

        /**
         * Get team list
         * @param {function(error, data)} callback
         */
        getTeams: function(callback) {
            request('teams', function(err, data) {
                if (err) { callback(err); return; }
                var teams = (data.data && data.data.teams) ? data.data.teams : { items: [] };
                callback(null, {
                    teams: teams.items || [],
                    count: teams.pageInfo ? teams.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            });
        },

        /**
         * Get attendance statements for a date range
         * @param {string} from - Start date (YYYY-MM-DD)
         * @param {string} to - End date (YYYY-MM-DD)
         * @param {function(error, data)} callback
         */
        getAttendance: function(from, to, callback) {
            request('attendance', function(err, data) {
                if (err) { callback(err); return; }
                var stmts = (data.data && data.data.attendanceStatements) ? data.data.attendanceStatements : { items: [], pageInfo: { count: 0 } };
                callback(null, {
                    statements: stmts.items || [],
                    count: stmts.pageInfo ? stmts.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            }, { from: from, to: to });
        },

        /**
         * Get time-off balances for all employees
         * @param {function(error, data)} callback
         */
        getTimeOffBalances: function(callback) {
            request('timeoff_balances', function(err, data) {
                if (err) { callback(err); return; }
                var balances = (data.data && data.data.timeOffBalances) ? data.data.timeOffBalances : { items: [], pageInfo: { count: 0 } };
                callback(null, {
                    balances: balances.items || [],
                    count: balances.pageInfo ? balances.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            });
        },

        /**
         * Get overtime balance statements
         * @param {function(error, data)} callback
         */
        getOvertime: function(callback) {
            request('overtime', function(err, data) {
                if (err) { callback(err); return; }
                var stmts = (data.data && data.data.overtimeBalanceStatements) ? data.data.overtimeBalanceStatements : { items: [], pageInfo: { count: 0 } };
                callback(null, {
                    statements: stmts.items || [],
                    count: stmts.pageInfo ? stmts.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            });
        },

        /**
         * Get time-off usage statements for a date range
         * @param {string} from - Start date (YYYY-MM-DD)
         * @param {string} to - End date (YYYY-MM-DD)
         * @param {string} typeIds - Comma-separated time-off type IDs
         * @param {function(error, data)} callback
         */
        getTimeOffUsage: function(from, to, typeIds, callback) {
            request('timeoff_usage', function(err, data) {
                if (err) { callback(err); return; }
                var stmts = (data.data && data.data.timeOffRequestUsageStatements) ? data.data.timeOffRequestUsageStatements : { items: [], pageInfo: { count: 0 } };
                callback(null, {
                    statements: stmts.items || [],
                    count: stmts.pageInfo ? stmts.pageInfo.count : 0,
                    cached: data._cached || false,
                });
            }, { from: from, to: to, typeIds: typeIds });
        },

        /**
         * Reset cached availability (e.g. after config change)
         */
        resetCache: function() {
            _available = null;
        },
    };
})();
