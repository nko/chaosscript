var MIME = require('./mime');
var RedisClient = require('redis-client-0.3.5');
var redis = RedisClient.createClient();
var FiletypeMapping = { mkv:'Video',
                        avi:'Video',
                        mpeg:'Video',
                        mpeg2:'Video',
                        mpg:'Video',
                        mp4:'Video',
                        divx:'Video',
                        xvid:'Video',
                        mp2:'Video',
                        wmv:'Video',
                        ogv:'Video',
                        mov:'Video',
                        mks:'Video',
                        asf:'Video',
                        svg:'Text',  // iframe ;-)
                        nfo:'Text',
                        js:'Text',
                        css:'Text',
                        txt:'Text',
                        jpg:'Image',
                        jpeg:'Image',
                        bmp:'Image',
                        png:'Image',
                        ogg:'Audio',
                        mp3:'Audio',
                        wav:'Audio',
                        flac:'Audio',
                        wma:'Audio',
                        '3gp':'Audio',
                        aac:'Audio',
                        wma:'Audio',
                        flac:'Audio',
                        mka:'Audio'};
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
    parseTreeByFiles: function( fileList, infohex ) {
        var result = {};
        var fSizeLabels = [ ' byte', 'KB', 'MB', 'GB', 'TB' ];
        fileList.forEach(function(f) {
            var path = f.name.split('/');
            var fType = f.name.match(/\.([^.]+)$/gi).toString();
            var fSize = parseInt(f.length);
            for(i = 0; i < fSizeLabels.length; i += 1)
                if ((fSize > 1024) && fSizeLabels.length >= i)
                    fSize = fSize/1024;
                else {
                    fSize = (Math.round(fSize*100)/100)+''+fSizeLabels[i];
                    break;
                }
                    
            fType = fType.substring(1,fType.length).toLowerCase();
            fType = (FiletypeMapping[fType] || 'unknown');
            var attrs = {'kind':fType,
                          'path':infohex+'/'+f.name,
                          'mime':MIME.fileType(f.name),
                          'type':'file',
                          'size':fSize }
            result[path[0]] = (result[path[0]] || {});
            if (path.length > 1) { // Directory
                result[path[0]]['type'] = 'directory';
                result[path[0]]['files'] = (result[path[0]]['files'] || {});
                var scndPart = path.slice(1,path.size).join('/');
                result[path[0]]['files'][scndPart] = (result[path[0]]['files'][scndPart] || {});
                for(k in attrs)
                    result[path[0]]['files'][scndPart][k] = attrs[k];
            } else { // File
                for(k in attrs)
                    result[path[0]][k] = attrs[k];
            }
          });
        return result;
    },

    getRecommendations: function(cb) {
        function walkRecommendations(infoHexes, results, cb) {
            if (infoHexes.length < 1)
                cb(null, results);
            else {
                var infoHex = infoHexes.shift();
                module.exports.getFileinfo(infoHex, function(error, fileinfo) {
                                               if (fileinfo)
                                                   results.push({ infoHex: infoHex,
                                                                  name: fileinfo.name.toString() || 'Torrent file'
                                                                });
                                               walkRecommendations(infoHexes, results, cb);
                                           });
            }
        }

        redis.get("recommendations", function(error, data) {
                      var infoHexes;
                      try {
                          infoHexes = JSON.parse(data.toString());
                      } catch (e) {
                          error = e.message;
                      }
                      if (error)
                          cb(error);
                      else if (infoHexes && infoHexes.shift) {
                          walkRecommendations(infoHexes, [], cb);
                      } else
                          cb(null, []);
                  });
    }
};
