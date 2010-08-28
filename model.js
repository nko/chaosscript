var RedisClient = require('redis-client-0.3.5');
var redis = RedisClient.createClient();
redis.select(1);

module.exports = {
    putTrackers: function(infoHex, urls, cb) {
        if (urls.length == 0) {
            cb();
        } else {
            var url = urls.pop();
            module.exports.putTracker(infoHex, url, function(error) {
                                          if (error)
                                              cb(error);
                                          else
                                              module.exports.putTrackers(infoHex, urls, cb);
                                      });
        }
    },

    putTracker: function(infoHex, url, cb) {
        redis.sadd("t:" + infoHex, url, cb);
    },

    getTrackers: function(infoHex, cb) {
        redis.smembers("t:" + infoHex, function(error, urls) {
                           if (error)
                               cb(error);
                           else if (!urls)
                           cb('Not found');
                           else
                               cb(null, urls);
                       });
    },

    putFileinfo: function(infoHex, list, cb) {
        var data = JSON.stringify(list);
        redis.set("f:" + infoHex, data, cb);
    },

    getFileinfo: function(infoHex, cb) {
        redis.get("f:" + infoHex, function(error, data) {
                      if (error)
                          cb(error);
                      else if (!data)
                          cb('Not found');
                      else {
                          var list = JSON.parse(data.toString());
                          cb(null, list);
                      }
                  });
    },
    parseTreeByFiles: function( fileList ) {
        var result = {};
        fileList.forEach(function(f) {
//            root = (new Buffer(f.name)).join('').split('/')[0];
            path = f.name.split('/');
            result[path[0]] = (result[path[0]] || {});
            if (path.length > 1) { // Directory
                result[path[0]]['type'] = 'directory';
                result[path[0]]['files'] = (result[path[0]]['files'] || {});
            } else { // File
                result[path[0]]['type'] = ['file'];
            }
          });
        fileList

        return result;
    }
};

